const { body, validationResult } = require('express-validator');
const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const User = require('../models/User');
const geminiExplanationService = require('../services/geminiExplanationService');

// Validation rules
const submitAnswerValidation = [
  body('questionId')
    .isMongoId()
    .withMessage('Invalid question ID'),
  body('userAnswer')
    .notEmpty()
    .withMessage('Answer is required'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive number')
];

// Submit or update answer for a question
const submitAnswer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { resultId } = req.params;
    const { questionId, userAnswer, timeSpent = 0, isMarkedForReview = false } = req.body;

    const result = await Result.findById(resultId);

    if (!result) {
      return res.status(404).json({
        message: 'Result not found'
      });
    }

    // Check if user owns this result
    if (result.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Check if result is still active
    if (!['started', 'in_progress'].includes(result.status)) {
      return res.status(400).json({
        message: 'Cannot update answer for completed exam'
      });
    }

    // Get the question to validate answer
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        message: 'Question not found'
      });
    }

    // Update the answer
    await result.updateAnswer(questionId, userAnswer, timeSpent, isMarkedForReview);

    // Calculate marks for this answer
    const markingResult = question.calculateMarks(userAnswer);
    
    // Update the answer with marking results
    const answerIndex = result.answers.findIndex(
      answer => answer.questionId && answer.questionId.toString() === questionId.toString()
    );

    if (answerIndex !== -1) {
      result.answers[answerIndex].isCorrect = question.isCorrect(userAnswer);
      result.answers[answerIndex].marksAwarded = markingResult.marks;
      await result.save();
    }

    res.json({
      message: 'Answer submitted successfully',
      data: {
        questionId,
        userAnswer,
        isCorrect: question.isCorrect(userAnswer),
        marksAwarded: markingResult.marks,
        needsManualGrading: markingResult.needsManualGrading,
        timeSpent,
        isMarkedForReview
      }
    });

  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      message: 'Failed to submit answer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get current exam progress
const getExamProgress = async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await Result.findById(resultId)
      .populate('examId', 'title settings schedule')
      .populate('answers.questionId', 'type text options marks');

    if (!result) {
      return res.status(404).json({
        message: 'Result not found'
      });
    }

    // Check if user owns this result
    if (result.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Calculate time remaining
    const examDurationMs = result.examId.settings.duration * 60 * 1000;
    const elapsedMs = Date.now() - result.timing.startedAt.getTime();
    const timeRemainingMs = Math.max(0, examDurationMs - elapsedMs);

    // Auto-submit if time is up
    if (timeRemainingMs === 0 && result.status === 'in_progress') {
      await result.submit(true); // Auto-submit
      
      // Update user exam history
      const user = await User.findById(result.userId);
      await user.addExamHistory(result.examId._id, result._id, result.score, result.totalMarks);
    }

    res.json({
      result: {
        id: result._id,
        examId: result.examId._id,
        examTitle: result.examId.title,
        status: result.status,
        attemptNumber: result.attemptNumber,
        answers: result.answers.map(answer => ({
          questionId: answer.questionId ? answer.questionId._id : null,
          userAnswer: answer.userAnswer,
          isMarkedForReview: answer.isMarkedForReview,
          timeSpent: answer.timeSpent,
          answeredAt: answer.answeredAt
        })),
        timing: {
          startedAt: result.timing.startedAt,
          timeRemainingMs,
          timeRemainingSeconds: Math.floor(timeRemainingMs / 1000)
        },
        analytics: result.analytics
      }
    });

  } catch (error) {
    console.error('Get exam progress error:', error);
    res.status(500).json({
      message: 'Failed to fetch exam progress',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Submit final exam
const submitExam = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { isAutoSubmit = false } = req.body;

    const result = await Result.findById(resultId)
      .populate('examId')
      .populate('answers.questionId');

    if (!result) {
      return res.status(404).json({
        message: 'Result not found'
      });
    }

    // Check if user owns this result
    if (result.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Check if already submitted
    if (['completed', 'submitted', 'auto_submitted'].includes(result.status)) {
      return res.status(400).json({
        message: 'Exam already submitted'
      });
    }

    // Grade all answers
    for (let i = 0; i < result.answers.length; i++) {
      const answer = result.answers[i];
      const question = answer.questionId;
      
      if (question) {
        const markingResult = question.calculateMarks(answer.userAnswer);
        answer.isCorrect = question.isCorrect(answer.userAnswer);
        answer.marksAwarded = markingResult.marks;
      }
    }

    // Submit the result
    await result.submit(isAutoSubmit);

    // Update user exam history
    const user = await User.findById(result.userId);
    await user.addExamHistory(result.examId._id, result._id, result.score, result.totalMarks);

    // Generate insights
    const insights = await result.generateInsights();

    res.json({
      message: 'Exam submitted successfully',
      result: {
        id: result._id,
        score: result.score,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        status: result.status,
        submittedAt: result.timing.submittedAt,
        analytics: result.analytics,
        insights,
        feedback: result.feedback
      }
    });

  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({
      message: 'Failed to submit exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get result details
const getResult = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { includeAnswers = 'false' } = req.query;

    let query = Result.findById(resultId)
      .populate('userId', 'name email')
      .populate('examId', 'title description settings createdBy');

    if (includeAnswers === 'true') {
      query = query.populate('answers.questionId');
    }

    const result = await query;

    if (!result) {
      return res.status(404).json({
        message: 'Result not found'
      });
    }

    // Check access permissions
    const canAccess = result.userId._id.toString() === req.user.id.toString() ||
                     result.examId.createdBy.toString() === req.user.id.toString() ||
                     req.user.role === 'admin';

    if (!canAccess) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Prepare response data
    const responseData = {
      id: result._id,
      user: result.userId,
      exam: result.examId,
      attemptNumber: result.attemptNumber,
      score: result.score,
      totalMarks: result.totalMarks,
      percentage: result.percentage,
      status: result.status,
      timing: result.timing,
      analytics: result.analytics,
      feedback: result.feedback,
      gradingStatus: result.gradingStatus,
      createdAt: result.createdAt
    };

    // Include answers if requested and user has permission
    if (includeAnswers === 'true') {
      responseData.answers = result.answers.map(answer => {
        // Handle case where question might have been deleted
        if (!answer.questionId) {
          return {
            questionId: answer.questionId,
            questionText: 'Question not available (deleted)',
            questionType: 'unknown',
            questionOptions: [],
            userAnswer: answer.userAnswer,
            correctAnswer: [],
            isCorrect: answer.isCorrect,
            marksAwarded: answer.marksAwarded,
            timeSpent: answer.timeSpent,
            isMarkedForReview: answer.isMarkedForReview
          };
        }
        
        return {
          questionId: answer.questionId._id,
          questionText: answer.questionId.text,
          questionType: answer.questionId.type,
          questionOptions: answer.questionId.options,
          questionDiagram: answer.questionId.diagram || null,
          userAnswer: answer.userAnswer,
          correctAnswer: answer.questionId.correct,
          isCorrect: answer.isCorrect,
          marksAwarded: answer.marksAwarded,
          timeSpent: answer.timeSpent,
          isMarkedForReview: answer.isMarkedForReview
        };
      });
    }

    // Include cheating flags if user is exam creator or admin
    if (result.examId.createdBy.toString() === req.user.id.toString() || req.user.role === 'admin') {
      responseData.cheatingFlags = result.cheatingFlags;
    }

    res.json({ result: responseData });

  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({
      message: 'Failed to fetch result',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user's results
const getUserResults = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      examId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { userId: req.user.id };

    if (examId) {
      filter.examId = examId;
    }

    if (status) {
      filter.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const results = await Result.find(filter)
      .populate('examId', 'title description createdBy')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Result.countDocuments(filter);

    res.json({
      results: results.map(result => ({
        id: result._id,
        exam: result.examId,
        attemptNumber: result.attemptNumber,
        score: result.score,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        status: result.status,
        timing: result.timing,
        analytics: result.analytics,
        createdAt: result.createdAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user results error:', error);
    res.status(500).json({
      message: 'Failed to fetch results',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get all results for an exam (for creators/admins)
const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const {
      page = 1,
      limit = 50,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get the exam to check if user is creator
    const Exam = require('../models/Exam');
    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }

    // Check if user is creator or admin
    const isCreator = exam.createdBy.toString() === req.user.id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        message: 'Access denied. Only exam creators can view all attempts.'
      });
    }

    // Build filter
    const filter = { examId };
    if (status) {
      filter.status = status;
    }

    // Build sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch results with user details
    const results = await Result.find(filter)
      .populate('userId', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Result.countDocuments(filter);

    // Calculate aggregate analytics
    const completedResults = results.filter(r => ['completed', 'submitted', 'auto_submitted'].includes(r.status));
    const totalScore = completedResults.reduce((sum, r) => sum + r.score, 0);
    const averageScore = completedResults.length > 0 ? (totalScore / completedResults.length) : 0;
    const scores = completedResults.map(r => r.score);
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    res.json({
      results: results.map(result => ({
        id: result._id,
        user: result.userId,
        attemptNumber: result.attemptNumber,
        score: result.score,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        status: result.status,
        timing: result.timing,
        analytics: result.analytics,
        cheatingFlags: result.cheatingFlags,
        createdAt: result.createdAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      aggregateAnalytics: {
        totalAttempts: total,
        completedAttempts: completedResults.length,
        averageScore: averageScore.toFixed(2),
        highestScore,
        lowestScore,
        examTitle: exam.title,
        totalMarks: exam.settings.totalMarks
      }
    });

  } catch (error) {
    console.error('Get exam results error:', error);
    res.status(500).json({
      message: 'Failed to fetch exam results',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Add cheating flag
const addCheatingFlag = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { type, details = '' } = req.body;

    const result = await Result.findById(resultId);

    if (!result) {
      return res.status(404).json({
        message: 'Result not found'
      });
    }

    // Check if user owns this result
    if (result.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    await result.addCheatingFlag(type, details);

    res.json({
      message: 'Cheating flag added',
      flag: {
        type,
        details,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Add cheating flag error:', error);
    res.status(500).json({
      message: 'Failed to add cheating flag',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const explainAnswer = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ message: 'questionId is required' });
    }

    const result = await Result.findById(resultId).populate({
      path: 'examId',
      populate: {
        path: 'questions'
      }
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Ensure user owns result or is admin
    if (result.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const question = (result.examId.questions || []).find((q) => q._id.toString() === questionId || q.id === questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found in exam' });
    }

    const answerRecord = (result.answers || []).find((a) => a.questionId.toString() === questionId);
    if (!answerRecord) {
      return res.status(404).json({ message: 'Answer not found in result' });
    }

    const explanation = await geminiExplanationService.generateExplanation({
      question,
      answerRecord,
      examTitle: result.examId.title
    });

    res.json({
      success: true,
      explanation
    });
  } catch (error) {
    console.error('Explain answer error:', error);
    res.status(500).json({
      message: 'Failed to generate explanation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  submitAnswer,
  getExamProgress,
  submitExam,
  getResult,
  getUserResults,
  getExamResults,
  addCheatingFlag,
  explainAnswer,
  submitAnswerValidation
};

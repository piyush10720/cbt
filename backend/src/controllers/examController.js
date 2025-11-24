const { body, validationResult } = require('express-validator');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Result = require('../models/Result');
const User = require('../models/User');

// Validation rules
const createExamValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('settings.duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 minute'),
  body('schedule.startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('schedule.endDate')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('questions')
    .isArray({ min: 1 })
    .withMessage('At least one question is required')
];

// Create new exam
const createExam = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, description, settings, schedule, access, questions } = req.body;

    // Validate schedule
    const startDate = new Date(schedule.startDate);
    const endDate = new Date(schedule.endDate);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        message: 'End date must be after start date'
      });
    }

    // Create questions first
    const createdQuestions = [];
    for (const questionData of questions) {
      const question = new Question({
        ...questionData,
        createdBy: req.user.id
      });
      await question.save();
      createdQuestions.push(question._id);
    }

    // Calculate total marks
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

    // Create exam
    const exam = new Exam({
      title,
      description,
      createdBy: req.user.id,
      questions: createdQuestions,
      settings: {
        ...settings,
        totalMarks
      },
      schedule,
      schedule,
      access: access || { type: 'private' },
      originalFiles: req.body.originalFiles
    });

    await exam.save();
    await exam.populate('questions');

    res.status(201).json({
      message: 'Exam created successfully',
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        settings: exam.settings,
        schedule: exam.schedule,
        access: exam.access,
        status: exam.status,
        questions: exam.questions,
        createdAt: exam.createdAt
      }
    });

  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      message: 'Failed to create exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get all exams (with filtering)
const getExams = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      createdBy, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      folderId
    } = req.query;

    const filter = {};
    
    // Filter by folder
    if (folderId) {
      if (folderId === 'root') {
        filter.$or = [
          { folders: { $exists: false } },
          { folders: null },
          { folders: { $size: 0 } }
        ];
      } else {
        filter.folders = folderId;
      }
    }
    
    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by creator (for teachers to see their own exams)
    if (createdBy === 'me') {
      filter.createdBy = req.user.id;
    } else if (createdBy) {
      filter.createdBy = createdBy;
    }

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // For students, only show published and accessible exams
    if (req.user.role === 'student') {
      filter.isPublished = true;
      filter.$or = [
        { 'access.type': 'public' },
        { 'access.allowedUsers': req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const exams = await Exam.find(filter)
      .populate('createdBy', 'name email')
      .populate('questions', 'type marks')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Exam.countDocuments(filter);

    res.json({
      exams: exams.map(exam => ({
        id: exam._id,
        title: exam.title,
        description: exam.description,
        createdBy: exam.createdBy,
        settings: exam.settings,
        schedule: exam.schedule,
        access: exam.access,
        status: exam.status,
        isPublished: exam.isPublished,
        questionCount: exam.questions.length,
        createdAt: exam.createdAt,
        isActive: exam.isActive()
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({
      message: 'Failed to fetch exams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get single exam by ID
const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeQuestions = 'false' } = req.query;

    let exam = await Exam.findById(id).populate('createdBy', 'name email');
 
    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }
 
    const isCreator = exam.createdBy._id.toString() === req.user.id.toString();
    const canViewQuestions = includeQuestions === 'true' && (isCreator || req.user.role === 'admin');

    // Check access permissions
    if (!exam.canUserAccess(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    if (canViewQuestions) {
      exam = await exam.populate('questions');
    }

    const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0;

    // Get exam statistics if user is the creator
    let statistics = null;
    if (isCreator || req.user.role === 'admin') {
      statistics = await exam.getStatistics();
    }

    res.json({
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        createdBy: exam.createdBy,
        questions: canViewQuestions ? exam.questions : undefined,
        questionCount,
        settings: exam.settings,
        schedule: exam.schedule,
        access: exam.access,
        originalFiles: exam.originalFiles,
        status: exam.status,
        isPublished: exam.isPublished,
        publishedAt: exam.publishedAt,
        createdAt: exam.createdAt,
        isActive: exam.isActive(),
        statistics
      }
    });

  } catch (error) {
    console.error('Get exam by ID error:', error);
    res.status(500).json({
      message: 'Failed to fetch exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update exam
const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }

    // Check if user can update this exam
    if (exam.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Prevent updates to published exams (except status changes)
    if (exam.isPublished && !['status', 'access'].includes(Object.keys(updates)[0])) {
      return res.status(400).json({
        message: 'Cannot modify published exam content'
      });
    }

    // Update questions if provided
    if (updates.questions) {
      // Delete old questions
      await Question.deleteMany({ _id: { $in: exam.questions } });
      
      // Create new questions
      const createdQuestions = [];
      for (const questionData of updates.questions) {
        const question = new Question(questionData);
        await question.save();
        createdQuestions.push(question._id);
      }
      
      updates.questions = createdQuestions;
      
      // Recalculate total marks
      const totalMarks = updates.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
      if (updates.settings) {
        updates.settings.totalMarks = totalMarks;
      } else {
        updates.settings = { ...exam.settings.toObject(), totalMarks };
      }
    }

    Object.assign(exam, updates);
    await exam.save();
    await exam.populate('questions');

    res.json({
      message: 'Exam updated successfully',
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        settings: exam.settings,
        schedule: exam.schedule,
        access: exam.access,
        status: exam.status,
        questions: exam.questions,
        updatedAt: exam.updatedAt
      }
    });

  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({
      message: 'Failed to update exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Publish exam
const publishExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate('questions');

    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }

    // Check permissions
    if (exam.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Validate exam before publishing
    if (!exam.questions || exam.questions.length === 0) {
      return res.status(400).json({
        message: 'Cannot publish exam without questions'
      });
    }

    // Check if all questions have correct answers (except descriptive)
    const questionsWithoutAnswers = exam.questions.filter(q => 
      q.type !== 'descriptive' && (!q.correct || q.correct.length === 0)
    );

    if (questionsWithoutAnswers.length > 0) {
      return res.status(400).json({
        message: `${questionsWithoutAnswers.length} questions are missing correct answers`,
        questionsWithoutAnswers: questionsWithoutAnswers.map(q => q.id)
      });
    }

    await exam.publish();

    res.json({
      message: 'Exam published successfully',
      exam: {
        id: exam._id,
        title: exam.title,
        isPublished: exam.isPublished,
        publishedAt: exam.publishedAt,
        status: exam.status
      }
    });

  } catch (error) {
    console.error('Publish exam error:', error);
    res.status(500).json({
      message: 'Failed to publish exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Unpublish exam
const unpublishExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }

    if (exam.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    if (!exam.isPublished) {
      return res.status(400).json({
        message: 'Exam is not published'
      });
    }

    await exam.unpublish();

    res.json({
      message: 'Exam unpublished successfully',
      exam: {
        id: exam._id,
        title: exam.title,
        isPublished: exam.isPublished,
        publishedAt: exam.publishedAt,
        status: exam.status
      }
    });
  } catch (error) {
    console.error('Unpublish exam error:', error);
    res.status(500).json({
      message: 'Failed to unpublish exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete exam
const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }

    // Check permissions
    if (exam.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Check if exam has results
    const resultCount = await Result.countDocuments({ examId: id });
    if (resultCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete exam with existing results'
      });
    }

    // Check if questions are used in other exams before deleting
    const questionsToDelete = [];
    for (const qId of exam.questions) {
      const otherExams = await Exam.countDocuments({
        _id: { $ne: exam._id },
        questions: qId
      });
      
      if (otherExams === 0) {
        questionsToDelete.push(qId);
      }
    }

    // Delete questions that are not shared
    if (questionsToDelete.length > 0) {
      await Question.deleteMany({ _id: { $in: questionsToDelete } });
    }

    // Delete exam
    await Exam.findByIdAndDelete(id);

    res.json({
      message: 'Exam deleted successfully'
    });

  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({
      message: 'Failed to delete exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Start exam attempt
const startExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate('questions');

    if (!exam) {
      return res.status(404).json({
        message: 'Exam not found'
      });
    }

    // Check if exam is active and accessible
    if (!exam.canUserAccess(req.user.id)) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    const now = new Date();

    if (!exam.isPublished) {
      return res.status(400).json({ message: 'Exam is not published yet' });
    }

    if (exam.schedule.startDate > now || exam.schedule.endDate < now) {
      return res.status(400).json({ message: 'Exam is not currently active' });
    }

    // Check attempt limits
    const existingAttempts = await Result.countDocuments({
      userId: req.user.id,
      examId: id
    });

    if (existingAttempts >= exam.settings.maxAttempts) {
      return res.status(400).json({
        message: 'Maximum attempts exceeded'
      });
    }

    // Check for existing active attempt
    const activeAttempt = await Result.findOne({
      userId: req.user.id,
      examId: id,
      status: { $in: ['started', 'in_progress'] }
    });

    if (activeAttempt) {
      return res.status(400).json({
        message: 'You already have an active attempt for this exam',
        resultId: activeAttempt._id
      });
    }

    // Create new result/attempt
    const result = new Result({
      userId: req.user.id,
      examId: id,
      attemptNumber: existingAttempts + 1,
      totalMarks: exam.settings.totalMarks,
      answers: exam.questions.map(question => ({
        questionId: question._id,
        userAnswer: null,
        isCorrect: null,
        marksAwarded: 0,
        timeSpent: 0,
        isMarkedForReview: false
      })),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await result.save();

    // Prepare questions for exam (without correct answers)
    const examQuestions = exam.questions.map(question => ({
      id: question._id,
      type: question.type,
      text: question.text,
      options: question.options,
      marks: question.marks,
      order: question.order,
      diagram: question.diagram || null
    }));

    // Randomize questions if enabled
    if (exam.settings.randomizeQuestions) {
      examQuestions.sort(() => Math.random() - 0.5);
    }

    res.json({
      message: 'Exam started successfully',
      data: {
        resultId: result._id,
        exam: {
          id: exam._id,
          title: exam.title,
          description: exam.description,
          settings: exam.settings,
          questions: examQuestions
        },
        attempt: {
          number: result.attemptNumber,
          startedAt: result.timing.startedAt,
          timeRemaining: exam.settings.duration * 60 // in seconds
        }
      }
    });

  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({
      message: 'Failed to start exam',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Merge exams
const mergeExams = async (req, res) => {
  try {
    const { examIds, title, description, settings, schedule, access } = req.body;

    if (!examIds || !Array.isArray(examIds) || examIds.length < 2) {
      return res.status(400).json({ message: 'At least two exams are required to merge' });
    }

    // Fetch all source exams - user can merge their own exams OR public exams
    const sourceExams = await Exam.find({ 
      _id: { $in: examIds},
      $or: [
        { createdBy: req.user.id }, // User's own exams
        { 'access.type': 'public', isPublished: true } // Public exams
      ]
    });

    if (sourceExams.length !== examIds.length) {
      return res.status(403).json({ 
        message: 'You can only merge your own exams or public exams. Invited/owner exams from others cannot be merged.' 
      });
    }

    // Collect all unique question IDs
    const allQuestionIds = new Set();
    sourceExams.forEach(exam => {
      exam.questions.forEach(qId => allQuestionIds.add(qId.toString()));
    });

    // Fetch original questions
    const originalQuestions = await Question.find({ _id: { $in: Array.from(allQuestionIds) } });

    // Clone questions
    const newQuestionIds = [];
    let totalMarks = 0;

    for (const question of originalQuestions) {
      const questionObj = question.toObject();
      delete questionObj._id;
      delete questionObj.id;
      delete questionObj.createdAt;
      delete questionObj.updatedAt;
      delete questionObj.__v;

      // Create new question
      const newQuestion = new Question({
        ...questionObj,
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Generate new unique ID
      });

      await newQuestion.save();
      newQuestionIds.push(newQuestion._id);
      totalMarks += (newQuestion.marks || 1);
    }

    // Create new merged exam
    const newExam = new Exam({
      title: title || `Merged Exam (${new Date().toLocaleDateString()})`,
      description: description || `Merged from ${sourceExams.length} exams`,
      createdBy: req.user.id,
      questions: newQuestionIds,
      settings: {
        ...settings,
        totalMarks
      },
      schedule: schedule || {
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
      },
      access: access || { type: 'private' },
      status: 'draft'
    });

    await newExam.save();

    res.status(201).json({
      message: 'Exams merged successfully',
      exam: newExam
    });

  } catch (error) {
    console.error('Merge exams error:', error);
    res.status(500).json({
      message: 'Failed to merge exams',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  createExam,
  getExams,
  getExamById,
  updateExam,
  publishExam,
  unpublishExam,
  deleteExam,
  startExam,
  mergeExams,
  createExamValidation
};

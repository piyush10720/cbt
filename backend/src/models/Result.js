const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  }, 
  userAnswer: mongoose.Schema.Types.Mixed, // Can be string, array, or number
  isCorrect: {
    type: Boolean,
    default: null // null for descriptive questions that need manual grading
  },
  marksAwarded: {
    type: Number,
    default: 0
  },
  timeSpent: {
    type: Number, // Time spent on this question in seconds
    default: 0
  },
  isMarkedForReview: {
    type: Boolean,
    default: false
  },
  answeredAt: Date
});

const resultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  answers: [answerSchema],
  score: {
    type: Number,
    default: 0
    // No min constraint - negative marks are allowed
  },
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
    // No min/max constraint - can be negative or > 100
  },
  status: {
    type: String,
    enum: ['started', 'in_progress', 'completed', 'submitted', 'auto_submitted', 'abandoned'],
    default: 'started'
  },
  timing: {
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: Date,
    totalTimeSpent: {
      type: Number, // Total time in seconds
      default: 0
    },
    timeRemaining: Number // Time remaining when submitted (in seconds)
  },
  analytics: {
    correctAnswers: {
      type: Number,
      default: 0
    },
    incorrectAnswers: {
      type: Number,
      default: 0
    },
    unanswered: {
      type: Number,
      default: 0
    },
    markedForReview: {
      type: Number,
      default: 0
    },
    averageTimePerQuestion: {
      type: Number,
      default: 0
    },
    questionWiseAnalysis: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      },
      subject: String,
      topic: String,
      difficulty: String,
      isCorrect: Boolean,
      timeSpent: Number,
      marksAwarded: Number
    }]
  },
  cheatingFlags: [{
    type: {
      type: String,
      enum: ['tab_switch', 'window_blur', 'copy_paste', 'right_click', 'dev_tools', 'fullscreen_exit']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }],
  feedback: {
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
    overallComment: String
  },
  gradingStatus: {
    type: String,
    enum: ['auto_graded', 'partially_graded', 'manually_graded', 'pending_review'],
    default: 'auto_graded'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  ipAddress: String,
  userAgent: String,
  browserFingerprint: String
}, {
  timestamps: true
});

// Compound indexes for better query performance
resultSchema.index({ userId: 1, examId: 1, attemptNumber: 1 }, { unique: true });
resultSchema.index({ examId: 1, status: 1 });
resultSchema.index({ userId: 1, createdAt: -1 });
resultSchema.index({ status: 1, gradingStatus: 1 });

// Calculate analytics before saving
resultSchema.pre('save', function(next) {
  if (this.isModified('answers') || this.isNew) {
    this.calculateAnalytics();
  }
  next();
});

// Method to calculate result analytics
resultSchema.methods.calculateAnalytics = function() {
  const answers = this.answers;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let unanswered = 0;
  let markedForReview = 0;
  let totalTimeSpent = 0;
  let totalScore = 0;

  answers.forEach(answer => {
    if (answer.userAnswer === null || answer.userAnswer === undefined || answer.userAnswer === '') {
      unanswered++;
    } else if (answer.isCorrect === true) {
      correctAnswers++;
    } else if (answer.isCorrect === false) {
      incorrectAnswers++;
    }

    if (answer.isMarkedForReview) {
      markedForReview++;
    }

    totalTimeSpent += answer.timeSpent || 0;
    totalScore += answer.marksAwarded || 0;
  });

  this.analytics.correctAnswers = correctAnswers;
  this.analytics.incorrectAnswers = incorrectAnswers;
  this.analytics.unanswered = unanswered;
  this.analytics.markedForReview = markedForReview;
  this.analytics.averageTimePerQuestion = answers.length > 0 ? Math.round(totalTimeSpent / answers.length) : 0;

  // Allow negative scores (negative marking can result in negative total)
  this.score = totalScore;
  this.percentage = this.totalMarks > 0 ? Math.round((totalScore / this.totalMarks) * 100) : 0;
  this.timing.totalTimeSpent = totalTimeSpent;
};

// Method to submit the result
resultSchema.methods.submit = function(isAutoSubmit = false) {
  this.status = isAutoSubmit ? 'auto_submitted' : 'submitted';
  this.timing.submittedAt = new Date();
  
  // Calculate time spent
  const timeSpent = Math.round((this.timing.submittedAt - this.timing.startedAt) / 1000);
  this.timing.totalTimeSpent = timeSpent;
  
  this.calculateAnalytics();
  return this.save();
};

// Method to add cheating flag
resultSchema.methods.addCheatingFlag = function(type, details = '') {
  this.cheatingFlags.push({
    type,
    details,
    timestamp: new Date()
  });
  return this.save();
};

// Method to update answer
resultSchema.methods.updateAnswer = function(questionId, userAnswer, timeSpent = 0, isMarkedForReview = false) {
  const existingAnswerIndex = this.answers.findIndex(
    answer => answer.questionId.toString() === questionId.toString()
  );

  const answerData = {
    questionId,
    userAnswer,
    timeSpent,
    isMarkedForReview,
    answeredAt: new Date()
  };

  if (existingAnswerIndex !== -1) {
    // Update existing answer
    this.answers[existingAnswerIndex] = { ...this.answers[existingAnswerIndex].toObject(), ...answerData };
  } else {
    // Add new answer
    this.answers.push(answerData);
  }

  this.status = 'in_progress';
  return this.save();
};

// Method to generate performance insights
resultSchema.methods.generateInsights = async function() {
  await this.populate('examId');
  await this.populate('answers.questionId');

  const insights = {
    performance: {
      score: this.score,
      percentage: this.percentage,
      rank: null, // Will be calculated separately
      timeEfficiency: this.calculateTimeEfficiency()
    },
    strengths: [],
    weaknesses: [],
    recommendations: []
  };

  // Analyze by subject/topic
  const subjectAnalysis = {};
  this.answers.forEach(answer => {
    if (answer.questionId && answer.questionId.subject) {
      const subject = answer.questionId.subject;
      if (!subjectAnalysis[subject]) {
        subjectAnalysis[subject] = { correct: 0, total: 0, timeSpent: 0 };
      }
      subjectAnalysis[subject].total++;
      subjectAnalysis[subject].timeSpent += answer.timeSpent || 0;
      if (answer.isCorrect) {
        subjectAnalysis[subject].correct++;
      }
    }
  });

  // Generate insights based on analysis
  Object.entries(subjectAnalysis).forEach(([subject, data]) => {
    const accuracy = (data.correct / data.total) * 100;
    const avgTime = data.timeSpent / data.total;

    if (accuracy >= 80) {
      insights.strengths.push(`Strong performance in ${subject} (${accuracy.toFixed(1)}% accuracy)`);
    } else if (accuracy < 50) {
      insights.weaknesses.push(`Needs improvement in ${subject} (${accuracy.toFixed(1)}% accuracy)`);
      insights.recommendations.push(`Focus more on ${subject} concepts and practice`);
    }

    if (avgTime > this.analytics.averageTimePerQuestion * 1.5) {
      insights.recommendations.push(`Work on time management for ${subject} questions`);
    }
  });

  this.feedback = {
    strengths: insights.strengths,
    weaknesses: insights.weaknesses,
    recommendations: insights.recommendations,
    overallComment: this.generateOverallComment(insights)
  };

  return insights;
};

// Helper method to calculate time efficiency
resultSchema.methods.calculateTimeEfficiency = function() {
  if (!this.timing.totalTimeSpent || !this.examId.settings.duration) {
    return 0;
  }
  
  const examDurationSeconds = this.examId.settings.duration * 60;
  const timeUsedPercentage = (this.timing.totalTimeSpent / examDurationSeconds) * 100;
  
  // Efficiency score: balance between time used and score achieved
  const scorePercentage = this.percentage;
  return Math.round((scorePercentage / timeUsedPercentage) * 100);
};

// Helper method to generate overall comment
resultSchema.methods.generateOverallComment = function(insights) {
  const percentage = this.percentage;
  let comment = '';

  if (percentage >= 90) {
    comment = 'Excellent performance! You have demonstrated mastery of the subject.';
  } else if (percentage >= 75) {
    comment = 'Good job! You have a solid understanding with room for minor improvements.';
  } else if (percentage >= 60) {
    comment = 'Fair performance. Focus on the identified weak areas for better results.';
  } else if (percentage >= 40) {
    comment = 'Below average performance. Significant improvement needed in multiple areas.';
  } else {
    comment = 'Poor performance. Comprehensive review and practice required.';
  }

  if (this.cheatingFlags.length > 0) {
    comment += ' Note: Some irregularities were detected during the exam.';
  }

  return comment;
};

module.exports = mongoose.model('Result', resultSchema);

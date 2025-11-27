const mongoose = require('mongoose');

const normalizeId = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object' && value._id) {
    return normalizeId(value._id);
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return null;
};

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Exam title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  folders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder'
  }],
  settings: {
    duration: {
      type: Number, // Duration in minutes
      required: [true, 'Exam duration is required'],
      min: [1, 'Duration must be at least 1 minute']
    },
    totalMarks: {
      type: Number,
      required: true,
      min: [0, 'Total marks cannot be negative']
    },
    passingMarks: {
      type: Number,
      min: [0, 'Passing marks cannot be negative']
    },
    negativeMarking: {
      type: Boolean,
      default: false
    },
    randomizeQuestions: {
      type: Boolean,
      default: false
    },
    randomizeOptions: {
      type: Boolean,
      default: false
    },
    showResultImmediately: {
      type: Boolean,
      default: true
    },
    allowReview: {
      type: Boolean,
      default: true
    },
    preventTabSwitch: {
      type: Boolean,
      default: true
    },
    webcamMonitoring: {
      type: Boolean,
      default: false
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: [1, 'At least 1 attempt must be allowed']
    },
    allowCalculator: {
      type: Boolean,
      default: false
    }
  },
  schedule: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  access: {
    type: {
      type: String,
      enum: ['owner', 'invited', 'public'], // Updated from 'private', 'restricted', 'public'
      default: 'owner' // Updated from 'private'
    },
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    accessCode: String,
    requireApproval: {
      type: Boolean,
      default: false
    },
    inviteCode: {
      type: String,
      sparse: true
    },
    inviteLink: {
      type: String,
      sparse: true
    },
    inviteLinkExpiry: Date
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'active', 'completed', 'archived'],
    default: 'draft'
  },
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    highestScore: {
      type: Number,
      default: 0
    },
    lowestScore: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    }
  },
  originalFiles: {
    questionPaper: {
      filename: String,
      path: String,
      url: String,
      uploadedAt: Date
    },
    answerKey: {
      filename: String,
      path: String,
      url: String,
      uploadedAt: Date
    }
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
examSchema.index({ createdBy: 1, createdAt: -1 });
examSchema.index({ status: 1 });
examSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
examSchema.index({ isPublished: 1, 'access.type': 1 });

// Validation for schedule
examSchema.pre('validate', function(next) {
  if (this.schedule.startDate && this.schedule.endDate) {
    if (this.schedule.startDate >= this.schedule.endDate) {
      return next(new Error('End date must be after start date'));
    }
  }
  
  if (this.settings.passingMarks && this.settings.totalMarks) {
    if (this.settings.passingMarks > this.settings.totalMarks) {
      return next(new Error('Passing marks cannot exceed total marks'));
    }
  }
  
  next();
});

// Calculate total marks from questions
examSchema.methods.calculateTotalMarks = async function() {
  await this.populate('questions');
  const totalMarks = this.questions.reduce((sum, question) => sum + question.marks, 0);
  this.settings.totalMarks = totalMarks;
  return totalMarks;
};

// Check if exam is currently active
examSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.schedule.startDate <= now && 
         this.schedule.endDate >= now &&
         this.isPublished;
};

// Check if user can access this exam
examSchema.methods.canUserAccess = function(userId) {
  const requestedId = normalizeId(userId);
  const creatorId = normalizeId(this.createdBy);

  if (!requestedId) {
    return false;
  }

  if (this.access.type === 'public') {
    return true;
  }

  // Owner/Private: Only creator has access
  if (this.access.type === 'owner' || this.access.type === 'private') {
    return creatorId === requestedId;
  }

  // Invited/Restricted: Creator + Allowed Users
  if (this.access.type === 'invited' || this.access.type === 'restricted') {
    if (creatorId === requestedId) {
      return true;
    }

    return (this.access.allowedUsers || []).some(id => normalizeId(id) === requestedId);
  }

  return false;
};

// Get exam statistics
examSchema.methods.getStatistics = async function() {
  const Result = mongoose.model('Result');
  const results = await Result.find({ examId: this._id, status: 'completed' });
  
  if (results.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      completionRate: 0,
      scoreDistribution: []
    };
  }
  
  const scores = results.map(r => r.score);
  const totalAttempts = results.length;
  const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / totalAttempts);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  
  // Calculate score distribution
  const ranges = [
    { label: '0-20%', min: 0, max: 20, count: 0 },
    { label: '21-40%', min: 21, max: 40, count: 0 },
    { label: '41-60%', min: 41, max: 60, count: 0 },
    { label: '61-80%', min: 61, max: 80, count: 0 },
    { label: '81-100%', min: 81, max: 100, count: 0 }
  ];
  
  results.forEach(result => {
    const percentage = (result.score / this.settings.totalMarks) * 100;
    const range = ranges.find(r => percentage >= r.min && percentage <= r.max);
    if (range) range.count++;
  });
  
  return {
    totalAttempts,
    averageScore,
    highestScore,
    lowestScore,
    completionRate: 100, // All results are completed
    scoreDistribution: ranges
  };
};

// Publish exam
examSchema.methods.publish = function() {
  this.isPublished = true;
  this.publishedAt = new Date();
  this.status = 'published';
  return this.save();
};

// Unpublish exam
examSchema.methods.unpublish = function() {
  this.isPublished = false;
  this.publishedAt = undefined;
  this.status = 'draft';
  return this.save();
};

module.exports = mongoose.model('Exam', examSchema);

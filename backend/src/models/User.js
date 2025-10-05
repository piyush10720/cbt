const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  profile: {
    avatar: String,
    bio: String,
    institution: String,
    phone: String
  },
  examHistory: [{
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam'
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Result'
    },
    attemptedAt: {
      type: Date,
      default: Date.now
    },
    score: Number,
    totalMarks: Number,
    percentage: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update exam history
userSchema.methods.addExamHistory = function(examId, resultId, score, totalMarks) {
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  
  this.examHistory.push({
    examId,
    resultId,
    score,
    totalMarks,
    percentage,
    attemptedAt: new Date()
  });
  
  return this.save();
};

// Get user stats
userSchema.methods.getStats = function() {
  const history = this.examHistory;
  if (history.length === 0) {
    return {
      totalExams: 0,
      averageScore: 0,
      bestScore: 0,
      recentActivity: []
    };
  }

  const totalExams = history.length;
  const averageScore = Math.round(
    history.reduce((sum, exam) => sum + exam.percentage, 0) / totalExams
  );
  const bestScore = Math.max(...history.map(exam => exam.percentage));
  const recentActivity = history
    .sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt))
    .slice(0, 5);

  return {
    totalExams,
    averageScore,
    bestScore,
    recentActivity
  };
};

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  examTitle: {
    type: String,
    required: true
  },
  resultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Result'
  },
  questionText: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    required: true
  },
  userAnswer: mongoose.Schema.Types.Mixed,
  correctAnswer: [String],
  isCorrect: Boolean,
  marksAwarded: Number,
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  tags: [String]
}, {
  timestamps: true
});

// Compound index to prevent duplicate bookmarks
bookmarkSchema.index({ userId: 1, questionId: 1, resultId: 1 }, { unique: true });

// Index for efficient querying
bookmarkSchema.index({ userId: 1, examId: 1 });
bookmarkSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);


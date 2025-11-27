const mongoose = require('mongoose');

const explanationSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
    index: true
  },
  userAnswer: {
    type: String,
    required: true
  },
  correctAnswer: {
    type: String,
    required: true
  },
  explanation: {
    overview: {
      type: String,
      required: true
    },
    why_user_answer: {
      type: String,
      required: true
    },
    why_correct_answer: {
      type: String,
      required: true
    },
    tips: [{
      type: String
    }]
  }
}, {
  timestamps: true
});

// Composite index for fast lookups
explanationSchema.index({ questionId: 1, userAnswer: 1, correctAnswer: 1 }, { unique: true });

// Static method to find or create explanation
explanationSchema.statics.findByKey = async function(questionId, userAnswer, correctAnswer) {
  // Normalize answers for consistent caching
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);
  
  return this.findOne({
    questionId,
    userAnswer: normalizedUserAnswer,
    correctAnswer: normalizedCorrectAnswer
  });
};

// Static method to create explanation
explanationSchema.statics.createExplanation = async function(questionId, userAnswer, correctAnswer, explanationData) {
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer);
  
  return this.create({
    questionId,
    userAnswer: normalizedUserAnswer,
    correctAnswer: normalizedCorrectAnswer,
    explanation: explanationData
  });
};

// Helper function to normalize answers for consistent caching
function normalizeAnswer(answer) {
  if (Array.isArray(answer)) {
    // Sort array answers for consistency
    return JSON.stringify(answer.sort());
  }
  if (typeof answer === 'string') {
    return answer.trim().toLowerCase();
  }
  return JSON.stringify(answer);
}

const Explanation = mongoose.model('Explanation', explanationSchema);

module.exports = Explanation;

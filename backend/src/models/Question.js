const mongoose = require('mongoose');

const collectOptionIdentifiers = (options = []) => {
  const identifiers = new Set();

  options.forEach(option => {
    if (typeof option !== 'string') {
      return;
    }

    const trimmed = option.trim();

    if (!trimmed) {
      return;
    }

    // Add full option text
    identifiers.add(trimmed);

    // Extract leading label (e.g. "A", "(B)", "1.") for letter/number based answers
    const match = trimmed.match(/^\(?([A-Z0-9])\)?[\.)\:\-]?\s*/i);
    if (match && match[1]) {
      identifiers.add(match[1].toUpperCase());
    }
  });

  return identifiers;
};

const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['mcq_single', 'mcq_multi', 'true_false', 'numeric', 'descriptive']
  },
  text: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  options: [{
    type: String,
    trim: true
  }],
  correct: [{
    type: String,
    required: function() {
      return this.type !== 'descriptive';
    }
  }],
  marks: {
    type: Number,
    required: true,
    min: [0, 'Marks cannot be negative'],
    default: 1
  },
  negative_marks: {
    type: Number,
    default: 0,
    validate: {
      validator: function(v) {
        return v <= 0; // Negative marks should be 0 or negative
      },
      message: 'Negative marks should be 0 or a negative number'
    }
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  subject: String,
  topic: String,
  explanation: String,
  imageUrl: String,
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Validation for MCQ questions
questionSchema.pre('validate', function(next) {
  if (this.type === 'mcq_single' || this.type === 'mcq_multi') {
    if (!this.options || this.options.length < 2) {
      return next(new Error('MCQ questions must have at least 2 options'));
    }
    if (!this.correct || this.correct.length === 0) {
      return next(new Error('MCQ questions must have correct answers'));
    }
    // Validate that correct answers exist in options
    const optionIdentifiers = collectOptionIdentifiers(this.options);
    const invalidAnswers = this.correct
      .map(answer => (typeof answer === 'string' ? answer.trim() : String(answer)))
      .filter(answer => {
        if (!answer) {
          return true;
        }

        return !(optionIdentifiers.has(answer) || optionIdentifiers.has(answer.toUpperCase()))
      });
    if (invalidAnswers.length > 0) {
      return next(new Error(`Correct answers not found in options: ${invalidAnswers.join(', ')}`));
    }
    // Single choice MCQ should have only one correct answer
    if (this.type === 'mcq_single' && this.correct.length > 1) {
      return next(new Error('Single choice MCQ can have only one correct answer'));
    }
  }
  
  if (this.type === 'true_false') {
    this.options = ['True', 'False'];
    if (!this.correct || !['True', 'False'].includes(this.correct[0])) {
      return next(new Error('True/False questions must have correct answer as "True" or "False"'));
    }
  }
  
  if (this.type === 'numeric') {
    if (!this.correct || this.correct.length === 0) {
      return next(new Error('Numeric questions must have correct answer'));
    }
    // Validate that correct answer is numeric
    if (isNaN(parseFloat(this.correct[0]))) {
      return next(new Error('Numeric questions must have numeric correct answer'));
    }
  }
  
  next();
});

// Method to check if an answer is correct
questionSchema.methods.isCorrect = function(userAnswer) {
  if (!userAnswer) return false;
  
  switch (this.type) {
    case 'mcq_single':
    case 'true_false':
      return this.correct.includes(userAnswer);
    
    case 'mcq_multi':
      if (!Array.isArray(userAnswer)) return false;
      return userAnswer.length === this.correct.length &&
             userAnswer.every(answer => this.correct.includes(answer)) &&
             this.correct.every(answer => userAnswer.includes(answer));
    
    case 'numeric':
      const correctNum = parseFloat(this.correct[0]);
      const userNum = parseFloat(userAnswer);
      return !isNaN(userNum) && Math.abs(correctNum - userNum) < 0.001; // Allow small floating point differences
    
    case 'descriptive':
      // Descriptive questions need manual evaluation
      return null;
    
    default:
      return false;
  }
};

// Method to calculate marks for this question
questionSchema.methods.calculateMarks = function(userAnswer) {
  if (this.type === 'descriptive') {
    // Descriptive questions need manual grading
    return { marks: 0, needsManualGrading: true };
  }
  
  const isCorrect = this.isCorrect(userAnswer);
  if (isCorrect === null) {
    return { marks: 0, needsManualGrading: true };
  }
  
  if (isCorrect) {
    return { marks: this.marks, needsManualGrading: false };
  } else {
    return { marks: this.negative_marks, needsManualGrading: false };
  }
};

module.exports = mongoose.model('Question', questionSchema);

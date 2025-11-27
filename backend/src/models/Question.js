const mongoose = require('mongoose');

const collectOptionIdentifiers = (options = []) => {
  const identifiers = new Set();

  options.forEach(option => {
    let optionText;
    let optionLabel;

    // Handle both string and object formats
    if (typeof option === 'string') {
      optionText = option.trim();
      optionLabel = null;
    } else if (option && typeof option === 'object') {
      // Object format: {label: "A", text: "...", diagram: {...}}
      optionLabel = option.label;
      optionText = option.text || option.label;
    } else {
      return;
    }

    if (!optionText) {
      return;
    }

    // Add the label if explicitly provided (object format)
    if (optionLabel) {
      const cleanLabel = String(optionLabel).trim().replace(/[()]/g, ''); // Remove parentheses
      identifiers.add(cleanLabel.toUpperCase());
      identifiers.add(cleanLabel);
      identifiers.add(`(${cleanLabel})`); // With parentheses
      identifiers.add(`(${cleanLabel.toUpperCase()})`);
    }

    // Add full option text
    identifiers.add(optionText);
    identifiers.add(optionText.toUpperCase());

    // Extract leading label from text (e.g. "A", "(B)", "1.") for letter/number based answers
    // Handle various formats: A, (A), A), A., A:, A-
    const match = optionText.match(/^\(?([A-Z0-9])\)?[\.)\:\-]?\s*/i);
    if (match && match[1]) {
      const letter = match[1].toUpperCase();
      identifiers.add(letter);
      identifiers.add(letter.toLowerCase());
      identifiers.add(`(${letter})`);
      identifiers.add(`(${letter.toLowerCase()})`);
      identifiers.add(`${letter})`);
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
    type: mongoose.Schema.Types.Mixed, // Support both String and Object with diagram
    trim: function() {
      return typeof this === 'string';
    }
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
  negative_marking_scheme: {
    type: String,
    enum: ['none', '1/4', '1/3', '1/2', 'custom'],
    default: 'none'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  subject: String,
  topic: String,
  tags: [String],
  explanation: String,
  imageUrl: String, // Legacy field for backward compatibility
  diagram: {
    present: {
      type: Boolean,
      default: false
    },
    page: Number,
    page_width: Number,
    page_height: Number,
    bounding_box: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    description: String,
    url: String,
    uploaded_at: Date,
    upload_error: String
  },
  order: {
    type: Number,
    default: 0
  },
  sourcePageNumber: {
    type: Number,
    min: 1
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
    console.log('Validating question:', {
      id: this.id,
      type: this.type,
      optionsCount: this.options.length,
      options: this.options,
      correctAnswers: this.correct,
      optionIdentifiers: Array.from(optionIdentifiers)
    });
    
    const invalidAnswers = this.correct
      .map(answer => (typeof answer === 'string' ? answer.trim() : String(answer)))
      .filter(answer => {
        if (!answer) {
          return true;
        }

        return !(optionIdentifiers.has(answer) || optionIdentifiers.has(answer.toUpperCase()))
      });
    if (invalidAnswers.length > 0) {
      return next(new Error(`Question ${this.id}: Correct answers not found in options: ${invalidAnswers.join(', ')}. Available options: ${Array.from(optionIdentifiers).slice(0, 10).join(', ')}`));
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
    // Allow range format: "min to max" or single numeric value
    const answerStr = this.correct[0];
    if (answerStr.includes(' to ')) {
      // Range format
      const parts = answerStr.split(' to ');
      if (parts.length === 2) {
        const min = parseFloat(parts[0].trim());
        const max = parseFloat(parts[1].trim());
        if (isNaN(min) || isNaN(max) || min > max) {
          return next(new Error('Numeric range must be valid: min to max (e.g., 10 to 20) where min <= max'));
        }
      } else {
        return next(new Error('Numeric range must be valid: min to max'));
      }
    } else {
      // Single value
      if (isNaN(parseFloat(answerStr))) {
        return next(new Error('Numeric questions must have numeric correct answer or range (min to max)'));
      }
    }
  }
  
  next();
});

// Method to check if an answer is correct
questionSchema.methods.isCorrect = function(userAnswer) {
  if (!userAnswer && userAnswer !== 0) return false;
  
  switch (this.type) {
    case 'mcq_single':
    case 'true_false':
      // Normalize comparison - remove parentheses and punctuation, handle case differences
      const normalizedUserAnswer = String(userAnswer).replace(/[()\.:\-]/g, '').trim().toUpperCase();
      const normalizedCorrect = this.correct.map(ans => String(ans).replace(/[()\.:\-]/g, '').trim().toUpperCase());
      
      // Debug logging
      console.log('Answer comparison:', {
        questionId: this.id,
        userAnswer: userAnswer,
        normalizedUserAnswer,
        correctAnswers: this.correct,
        normalizedCorrect,
        result: normalizedCorrect.includes(normalizedUserAnswer)
      });
      
      return normalizedCorrect.includes(normalizedUserAnswer);
    
    case 'mcq_multi':
      if (!Array.isArray(userAnswer)) return false;
      // Normalize all answers for comparison - remove parentheses and punctuation
      const normalizedUserAnswers = userAnswer.map(ans => String(ans).replace(/[()\.:\-]/g, '').trim().toUpperCase());
      const normalizedCorrectAnswers = this.correct.map(ans => String(ans).replace(/[()\.:\-]/g, '').trim().toUpperCase());
      return normalizedUserAnswers.length === normalizedCorrectAnswers.length &&
             normalizedUserAnswers.every(answer => normalizedCorrectAnswers.includes(answer)) &&
             normalizedCorrectAnswers.every(answer => normalizedUserAnswers.includes(answer));
    
    case 'numeric':
      const userNum = parseFloat(userAnswer);
      if (isNaN(userNum)) return false;
      
      const answerStr = this.correct[0];
      
      // Check if range format (min to max)
      if (answerStr.includes(' to ')) {
        const parts = answerStr.split(' to ');
        if (parts.length === 2) {
          const min = parseFloat(parts[0].trim());
          const max = parseFloat(parts[1].trim());
          return userNum >= min && userNum <= max;
        }
      }
      
      // Single value - allow small floating point differences
      const correctNum = parseFloat(answerStr);
      if (!isNaN(correctNum)) {
        return Math.abs(correctNum - userNum) < 0.001;
      }
      return false;
    
    case 'descriptive':
      // Descriptive questions need manual evaluation
      return null;
    
    default:
      return false;
  }
};

// Method to calculate marks for this question
questionSchema.methods.calculateMarks = function(userAnswer) {
  // Check if question was actually attempted
  const isAttempted = userAnswer !== null && 
                     userAnswer !== undefined && 
                     userAnswer !== '' &&
                     !(Array.isArray(userAnswer) && userAnswer.length === 0);

  // Unanswered questions get 0 marks (no penalty)
  if (!isAttempted) {
    return { marks: 0, needsManualGrading: false };
  }

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
    // Negative marks only for WRONG answers, not unanswered
    return { marks: this.negative_marks, needsManualGrading: false };
  }
};

module.exports = mongoose.model('Question', questionSchema);

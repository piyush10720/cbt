import { Question } from '@/lib/api'
import { getOptionLabel } from './questionHelpers'

export interface ValidationError {
  field: string
  message: string
}

/**
 * Validate a question and return any errors
 */
export const validateQuestion = (question: Question, index: number): ValidationError[] => {
  const errors: ValidationError[] = []

  // Validate question text
  if (!question.text || !question.text.trim()) {
    errors.push({
      field: 'text',
      message: `Question ${index + 1}: Question text is required`
    })
  }

  // Validate based on type
  if (question.type === 'mcq_single' || question.type === 'mcq_multi' || question.type === 'true_false') {
    // Check if options exist
    if (!question.options || question.options.length < 2) {
      errors.push({
        field: 'options',
        message: `Question ${index + 1}: At least 2 options are required`
      })
    }

    // Check if all options have text
    if (question.options) {
      question.options.forEach((option, idx) => {
        const optionText = typeof option === 'string' ? option : option.text
        if (!optionText || !optionText.trim()) {
          errors.push({
            field: 'options',
            message: `Question ${index + 1}: Option ${String.fromCharCode(65 + idx)} is empty`
          })
        }
      })
    }

    // Check if correct answer is selected
    if (!question.correct || question.correct.length === 0) {
      errors.push({
        field: 'correct',
        message: `Question ${index + 1}: Please select at least one correct answer`
      })
    }

    // Check if correct answers match available options
    if (question.correct && question.correct.length > 0 && question.options && question.options.length > 0) {
      const optionLabels = question.options.map(opt => {
        const label = getOptionLabel(opt)
        // Remove parentheses and other punctuation, then normalize
        return label.replace(/[()\.:\-]/g, '').trim().toUpperCase()
      })
      
      const invalidCorrect = question.correct.filter(ans => {
        // Normalize the correct answer the same way
        const normalized = String(ans).replace(/[()\.:\-]/g, '').trim().toUpperCase()
        return !optionLabels.includes(normalized)
      })

      if (invalidCorrect.length > 0) {
        errors.push({
          field: 'correct',
          message: `Question ${index + 1}: Correct answer "${invalidCorrect.join(', ')}" not found in options. Available: ${optionLabels.join(', ')}`
        })
      }
    }

    // Check single vs multiple correct answers
    if (question.type === 'mcq_single' && question.correct && question.correct.length > 1) {
      errors.push({
        field: 'correct',
        message: `Question ${index + 1}: Single choice questions can only have one correct answer`
      })
    }
  }

  // Validate numeric
  if (question.type === 'numeric') {
    if (!question.correct || question.correct.length === 0 || !question.correct[0]) {
      errors.push({
        field: 'correct',
        message: `Question ${index + 1}: Numeric answer is required`
      })
    } else {
      const answer = question.correct[0]
      // Check if it's a range
      if (answer.includes('-')) {
        const parts = answer.split('-')
        if (parts.length === 2) {
          const min = parseFloat(parts[0])
          const max = parseFloat(parts[1])
          if (isNaN(min) || isNaN(max)) {
            errors.push({
              field: 'correct',
              message: `Question ${index + 1}: Invalid numeric range format. Use min-max (e.g., 41.5-42.5)`
            })
          } else if (min >= max) {
            errors.push({
              field: 'correct',
              message: `Question ${index + 1}: Numeric range invalid - min must be less than max`
            })
          }
        }
      } else {
        // Single value
        if (isNaN(parseFloat(answer))) {
          errors.push({
            field: 'correct',
            message: `Question ${index + 1}: Numeric answer must be a valid number`
          })
        }
      }
    }
  }

  // Validate marks
  if (!question.marks || question.marks <= 0) {
    errors.push({
      field: 'marks',
      message: `Question ${index + 1}: Marks must be greater than 0`
    })
  }

  return errors
}

/**
 * Validate all questions in an exam
 */
export const validateAllQuestions = (questions: Question[]): { valid: boolean; errors: ValidationError[]; questionErrors: Map<string, ValidationError[]> } => {
  const allErrors: ValidationError[] = []
  const questionErrors = new Map<string, ValidationError[]>()

  questions.forEach((question, index) => {
    const errors = validateQuestion(question, index)
    if (errors.length > 0) {
      allErrors.push(...errors)
      questionErrors.set(question.id, errors)
    }
  })

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    questionErrors
  }
}


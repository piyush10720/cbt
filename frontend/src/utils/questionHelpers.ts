import { QuestionOption } from '../lib/api'

/**
 * Get the label from an option (handles both string and object formats)
 */
export const getOptionLabel = (option: string | QuestionOption): string => {
  if (typeof option === 'string') {
    return option
  }
  return option.label
}

/**
 * Get the text from an option (handles both string and object formats)
 */
export const getOptionText = (option: string | QuestionOption): string => {
  if (typeof option === 'string') {
    return option
  }
  return option.text || option.label
}

/**
 * Get the diagram URL from an option if it exists
 */
export const getOptionDiagramUrl = (option: string | QuestionOption): string | null => {
  if (typeof option === 'string') {
    return null
  }
  return option.diagram?.url || null
}

/**
 * Check if an option has a diagram
 */
export const hasOptionDiagram = (option: string | QuestionOption): boolean => {
  if (typeof option === 'string') {
    return false
  }
  return option.diagram?.present === true && !!option.diagram?.url
}

/**
 * Check if two options match (handles both formats)
 */
export const optionsMatch = (option1: string | QuestionOption, option2: string | QuestionOption): boolean => {
  const label1 = getOptionLabel(option1)
  const label2 = getOptionLabel(option2)
  return label1 === label2
}

/**
 * Find an option by label in an array
 */
export const findOptionByLabel = (
  options: (string | QuestionOption)[],
  label: string
): string | QuestionOption | undefined => {
  return options.find(opt => getOptionLabel(opt) === label)
}

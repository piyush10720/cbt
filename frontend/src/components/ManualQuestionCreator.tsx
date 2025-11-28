import React, { useState, useRef } from 'react'
import type { Question } from '@/lib/api'
// @ts-ignore - imageUploadAPI export exists but TypeScript cache hasn't updated
import { imageUploadAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import MathText from '@/components/MathText'
import { Plus, Trash2, Upload as UploadIcon, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

import { QUESTION_TYPES, LATEX_TEMPLATES, MATH_SYMBOLS, NEGATIVE_MARKING_OPTIONS } from '@/config/question'
import useQuestion from '@/hooks/useQuestion'

interface ManualQuestionCreatorProps {
  onAddQuestion: (question: Question) => void
}


const ManualQuestionCreator: React.FC<ManualQuestionCreatorProps> = ({ onAddQuestion }) => {
  const [questionType, setQuestionType] = useState<Question['type']>('mcq_single')
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', ''])
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([])
  const [marks, setMarks] = useState(1)
  const [negativeMarkingScheme, setNegativeMarkingScheme] = useState<'1/4' | '1/3' | '1/2' | 'custom' | 'none'>('1/4')
  const [customNegativeMarks, setCustomNegativeMarks] = useState(0)
  const [numericAnswer, setNumericAnswer] = useState('')
  const [numericAnswerType, setNumericAnswerType] = useState<'single' | 'range'>('single')
  const [numericMin, setNumericMin] = useState('')
  const [numericMax, setNumericMax] = useState('')
  const [descriptiveAnswer, setDescriptiveAnswer] = useState('')
  const [showSymbols, setShowSymbols] = useState(false)
  const [questionDiagram, setQuestionDiagram] = useState<{ present: boolean; url?: string; description?: string }>({ present: false })
  const [optionDiagrams, setOptionDiagrams] = useState<Record<number, { url: string; description?: string }>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [uploadingQuestionDiagram, setUploadingQuestionDiagram] = useState(false)
  const [uploadingOptionDiagram, setUploadingOptionDiagram] = useState<number | null>(null)
  const tempQuestionId = `temp-${Date.now()}`



  // Calculate actual negative marks based on scheme

  const {calculatedNegativeMarks} = useQuestion(negativeMarkingScheme, marks, customNegativeMarks)

  const handleTypeChange = (type: Question['type']) => {
    setQuestionType(type)
    setCorrectAnswers([])
    setOptionDiagrams({}) // Clear option diagrams when changing type
    
    if (type === 'true_false') {
      setOptions(['True', 'False'])
    } else if (type === 'numeric' || type === 'descriptive') {
      setOptions([])
    } else if (options.length === 0) {
      setOptions(['', '', '', ''])
    }
  }

  const handleAddOption = () => {
    if (options.length >= 8) {
      toast.error('Maximum 8 options allowed')
      return
    }
    setOptions([...options, ''])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('At least 2 options required')
      return
    }
    const optionLabel = String.fromCharCode(65 + index)
    setOptions(options.filter((_, i) => i !== index))
    setCorrectAnswers(correctAnswers.filter(ans => ans !== optionLabel))
  }

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const handleCorrectToggle = (optionIndex: number) => {
    const optionLabel = String.fromCharCode(65 + optionIndex)
    
    if (questionType === 'mcq_single' || questionType === 'true_false') {
      setCorrectAnswers([optionLabel])
    } else if (questionType === 'mcq_multi') {
      if (correctAnswers.includes(optionLabel)) {
        setCorrectAnswers(correctAnswers.filter(ans => ans !== optionLabel))
      } else {
        setCorrectAnswers([...correctAnswers, optionLabel])
      }
    }
  }

  const insertSymbol = (latex: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setQuestionText(prev => prev + ' $' + latex + '$ ')
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = questionText.substring(0, start)
    const textAfter = questionText.substring(end)
    
    const symbolToInsert = ' $' + latex + '$ '
    const newText = textBefore + symbolToInsert + textAfter
    
    setQuestionText(newText)
    
    // Set cursor position after inserted symbol
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + symbolToInsert.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
    
    toast.success('Symbol inserted')
  }

  const handleQuestionDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setUploadingQuestionDiagram(true)

    try {
      const response = await imageUploadAPI.uploadDiagram(file, {
        type: 'question',
        questionId: tempQuestionId
      })

      const cloudinaryUrl = response.data.data.url

      setQuestionDiagram({
        present: true,
        url: cloudinaryUrl,
        description: 'Question diagram'
      })
      toast.success('Question diagram uploaded')
    } catch (error) {
      console.error('Question diagram upload error:', error)
      toast.error('Failed to upload diagram')
    } finally {
      setUploadingQuestionDiagram(false)
    }
  }

  const handleOptionDiagramUpload = async (optionIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const optionLabel = String.fromCharCode(65 + optionIndex)
    setUploadingOptionDiagram(optionIndex)

    try {
      const response = await imageUploadAPI.uploadDiagram(file, {
        type: 'option',
        questionId: tempQuestionId,
        optionLabel: optionLabel
      })

      const cloudinaryUrl = response.data.data.url

      setOptionDiagrams(prev => ({
        ...prev,
        [optionIndex]: {
          url: cloudinaryUrl,
          description: `Option ${optionLabel} diagram`
        }
      }))
      toast.success(`Diagram uploaded for option ${optionLabel}`)
    } catch (error) {
      console.error('Option diagram upload error:', error)
      toast.error('Failed to upload diagram')
    } finally {
      setUploadingOptionDiagram(null)
    }
  }

  const handleCreate = () => {
    // Validation
    if (!questionText.trim()) {
      toast.error('Please enter question text')
      return
    }

    if (questionType === 'mcq_single' || questionType === 'mcq_multi' || questionType === 'true_false') {
      if (options.some(opt => !opt.trim())) {
        toast.error('All options must have text')
        return
      }
      if (correctAnswers.length === 0) {
        toast.error('Please select at least one correct answer')
        return
      }
    }

    if (questionType === 'numeric') {
      if (numericAnswerType === 'single' && !numericAnswer.trim()) {
        toast.error('Please enter the correct numeric answer')
        return
      }
      if (numericAnswerType === 'range') {
        if (!numericMin.trim() || !numericMax.trim()) {
          toast.error('Please enter both min and max values for range')
          return
        }
        const min = parseFloat(numericMin)
        const max = parseFloat(numericMax)
        if (isNaN(min) || isNaN(max)) {
          toast.error('Min and max must be valid numbers')
          return
        }
        if (min >= max) {
          toast.error('Min value must be less than max value')
          return
        }
      }
    }

    // Create options with diagrams if applicable
    const finalOptions = (questionType === 'numeric' || questionType === 'descriptive') 
      ? [] 
      : options.map((optText, idx) => {
          if (optionDiagrams[idx]) {
            return {
              label: String.fromCharCode(65 + idx),
              text: optText,
              diagram: {
                present: true,
                url: optionDiagrams[idx].url,
                description: optionDiagrams[idx].description,
                uploaded_at: new Date().toISOString()
              }
            }
          }
          return optText
        })

    // Prepare correct answer based on type
    let correctAnswer: string[]
    if (questionType === 'numeric') {
      if (numericAnswerType === 'range') {
        // Store range as "min-max"
        correctAnswer = [`${numericMin.trim()}-${numericMax.trim()}`]
      } else {
        correctAnswer = [numericAnswer]
      }
    } else if (questionType === 'descriptive') {
      correctAnswer = [descriptiveAnswer]
    } else {
      correctAnswer = correctAnswers
    }

    // Create question object
    const newQuestion: any = {
      id: `manual-${Date.now()}`,
      type: questionType,
      text: questionText,
      options: finalOptions,
      correct: correctAnswer,
      marks: marks,
      negative_marks: calculatedNegativeMarks,
      negative_marking_scheme: negativeMarkingScheme,
      diagram: questionDiagram.present ? questionDiagram : undefined
    }

    onAddQuestion(newQuestion)

    // Reset form
    setQuestionText('')
    setOptions(['', '', '', ''])
    setCorrectAnswers([])
    setMarks(1)
    setNegativeMarkingScheme('1/4')
    setCustomNegativeMarks(0)
    setNumericAnswer('')
    setNumericAnswerType('single')
    setNumericMin('')
    setNumericMax('')
    setDescriptiveAnswer('')
    setQuestionDiagram({ present: false })
    setOptionDiagrams({})
    
    toast.success('Question added successfully!')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Question Manually</CardTitle>
        <CardDescription>
          Build a question from scratch with rich text formatting and mathematical symbols
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Question Type */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Question Type</label>
          <select
            value={questionType}
            onChange={(e) => handleTypeChange(e.target.value as Question['type'])}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Question Text */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">Question Text</label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSymbols(!showSymbols)}
              type="button"
            >
              {showSymbols ? 'Hide' : 'Show'} Symbols
            </Button>
          </div>

          {showSymbols && (
            <div className="mb-3 p-3 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-md space-y-3">
              {/* LaTeX Templates */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Common Templates:</p>
                <div className="flex flex-wrap gap-1">
                  {LATEX_TEMPLATES.map((item) => (
                    <Button
                      key={item.latex}
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(item.latex)}
                      className="h-8 px-3 text-sm hover:bg-blue-100 hover:border-blue-400"
                      title={item.label}
                      type="button"
                    >
                      {item.symbol}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Greek Letters & Symbols */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Symbols & Greek Letters:</p>
                <div className="grid grid-cols-12 gap-1">
                  {MATH_SYMBOLS.map((item) => (
                    <Button
                      key={item.latex}
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(item.latex)}
                      className="h-8 w-full p-0 text-base hover:bg-blue-100 hover:border-blue-400"
                      title={item.label}
                      type="button"
                    >
                      {item.symbol}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Help Section */}
              <div className="bg-background p-2 rounded border border-blue-100 dark:border-blue-900">
                <p className="text-xs text-foreground font-medium mb-1">
                  💡 Tips:
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
                  <li>Symbols insert at your cursor position</li>
                  <li>Preview appears below when you use math notation</li>
                  <li>Type LaTeX manually: <code className="bg-muted px-1 rounded">$\alpha + \beta^2$</code></li>
                </ul>
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full min-h-[120px] rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-background"
            placeholder="Enter your question (supports LaTeX: $\alpha$, $\beta$, etc.)"
          />

          {/* Live Preview of Question Text with Math Rendering */}
          {questionText && (questionText.includes('$') || questionText.includes('\\')) && (
            <div className="p-3 border border-border rounded bg-muted/50 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview:</p>
              <div className="text-sm leading-relaxed">
                <MathText text={questionText} block />
              </div>
            </div>
          )}

          {/* Question Diagram Upload */}
          <div className="mt-2">
            {questionDiagram.present && questionDiagram.url ? (
              <div className="relative inline-block">
                <img
                  src={questionDiagram.url}
                  alt="Question diagram"
                  className="max-h-40 rounded border border-border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setQuestionDiagram({ present: false })}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : uploadingQuestionDiagram ? (
              <Button variant="outline" size="sm" disabled>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Uploading...</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQuestionDiagramUpload}
                    className="hidden"
                  />
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Add Question Diagram
                </label>
              </Button>
            )}
          </div>
        </div>

        {/* Options for MCQ */}
        {(questionType === 'mcq_single' || questionType === 'mcq_multi' || questionType === 'true_false') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Options {questionType === 'mcq_multi' ? '(Select all correct)' : '(Select one correct)'}
              </label>
              {questionType !== 'true_false' && (
                <Button variant="outline" size="sm" onClick={handleAddOption} type="button">
                  <Plus className="h-4 w-4 mr-1" /> Add Option
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((option, idx) => {
                const optionLabel = String.fromCharCode(65 + idx)
                const isCorrect = correctAnswers.includes(optionLabel)

                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-start gap-2">
                      {questionType === 'mcq_multi' ? (
                        <input
                          type="checkbox"
                          checked={isCorrect}
                          onChange={() => handleCorrectToggle(idx)}
                          className="mt-2"
                        />
                      ) : (
                        <input
                          type="radio"
                          name="correct-answer"
                          checked={isCorrect}
                          onChange={() => handleCorrectToggle(idx)}
                          className="mt-2"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={option}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Option ${optionLabel}`}
                            className="font-mono flex-1"
                            disabled={questionType === 'true_false'}
                          />
                          {uploadingOptionDiagram === idx ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              title="Uploading..."
                              type="button"
                            >
                              <LoadingSpinner size="sm" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              title="Add diagram"
                              type="button"
                            >
                              <label className="cursor-pointer px-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleOptionDiagramUpload(idx, e)}
                                  className="hidden"
                                />
                                <UploadIcon className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </label>
                            </Button>
                          )}
                        </div>

                        {/* Live Preview of Option Text with Math Rendering */}
                        {option && (option.includes('$') || option.includes('\\')) && (
                          <div className="p-2 border border-border rounded bg-muted/50 text-sm">
                            <MathText text={option} />
                          </div>
                        )}
                        
                        {optionDiagrams[idx] && (
                          <div className="mt-2 relative inline-block">
                            <img
                              src={optionDiagrams[idx].url}
                              alt={`Option ${optionLabel} diagram`}
                              className="max-h-32 rounded border border-border"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => {
                                setOptionDiagrams(prev => {
                                  const updated = { ...prev }
                                  delete updated[idx]
                                  return updated
                                })
                                toast.success('Diagram removed')
                              }}
                              type="button"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {questionType !== 'true_false' && options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOption(idx)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Numeric Answer */}
        {questionType === 'numeric' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">Correct Numeric Answer</label>
            
            {/* Answer Type Selection */}
            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={numericAnswerType === 'single'}
                  onChange={() => setNumericAnswerType('single')}
                  className="h-4 w-4"
                />
                <span className="text-sm">Single Value</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={numericAnswerType === 'range'}
                  onChange={() => setNumericAnswerType('range')}
                  className="h-4 w-4"
                />
                <span className="text-sm">Range (Min - Max)</span>
              </label>
            </div>

            {numericAnswerType === 'single' ? (
              <Input
                type="number"
                step="any"
                value={numericAnswer}
                onChange={(e) => setNumericAnswer(e.target.value)}
                placeholder="Enter the correct numeric answer (e.g., 42.5)"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Minimum Value</label>
                  <Input
                    type="number"
                    step="any"
                    value={numericMin}
                    onChange={(e) => setNumericMin(e.target.value)}
                    placeholder="Min (e.g., 41.5)"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Maximum Value</label>
                  <Input
                    type="number"
                    step="any"
                    value={numericMax}
                    onChange={(e) => setNumericMax(e.target.value)}
                    placeholder="Max (e.g., 42.5)"
                  />
                </div>
              </div>
            )}

            {numericAnswerType === 'range' && numericMin && numericMax && (
              <div className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2 text-green-700 dark:text-green-300">
                Any answer between <span className="font-semibold">{numericMin}</span> and <span className="font-semibold">{numericMax}</span> will be marked correct
              </div>
            )}
          </div>
        )}

        {/* Descriptive Answer Notes */}
        {questionType === 'descriptive' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Answer Guidelines/Notes (Optional)
            </label>
            <textarea
              value={descriptiveAnswer}
              onChange={(e) => setDescriptiveAnswer(e.target.value)}
              className="w-full min-h-[80px] rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              placeholder="Guidance for manual grading (optional)"
            />
          </div>
        )}

        {/* Marks Configuration */}
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Positive Marks
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Negative Marking
              </label>
              <select
                value={negativeMarkingScheme}
                onChange={(e) => setNegativeMarkingScheme(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NEGATIVE_MARKING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {negativeMarkingScheme === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Custom Negative Marks
              </label>
              <Input
                type="number"
                max="0"
                step="0.25"
                value={customNegativeMarks}
                onChange={(e) => setCustomNegativeMarks(Number(e.target.value))}
                placeholder="Enter negative value (e.g., -0.5)"
              />
            </div>
          )}

          {/* Show calculated negative marks */}
          {negativeMarkingScheme !== 'none' && (
            <div className="text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2">
              <span className="font-medium text-foreground">Effective Negative Marks: </span>
              <span className="text-red-600 font-semibold">{calculatedNegativeMarks.toFixed(2)}</span>
              <span className="text-muted-foreground ml-2">
                (for incorrect answer)
              </span>
            </div>
          )}
        </div>

        {/* Create Button */}
        <Button onClick={handleCreate} className="w-full bg-green-600 hover:bg-green-700" type="button">
          <Check className="h-4 w-4 mr-2" />
          Add Question to Exam
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-2">
          Click to add this question. Form will reset for adding more questions.
        </p>
      </CardContent>
    </Card>
  )
}

export default ManualQuestionCreator


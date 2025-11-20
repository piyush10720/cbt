import React, { useMemo, useState } from 'react'
import { Question } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, ChevronLeft, ChevronRight, Copy, Delete, Minus, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOptionLabel, getOptionText, hasOptionDiagram, getOptionDiagramUrl } from '@/utils/questionHelpers'
import ImageModal from '@/components/ImageModal'

const getOptionIdentifiers = (option: string | any) => {
  const identifiers = new Set<string>()
  
  // Get the text/label from the option (could be string or object)
  const optionLabel = typeof option === 'string' ? option : (option?.label || option?.text || '')
  if (!optionLabel) return identifiers

  const trimmed = optionLabel.toString().trim()
  if (!trimmed) return identifiers

  identifiers.add(trimmed.toLowerCase())

  const match = trimmed.match(/^\(?([A-Z0-9])\)?[\.)\:-]?\s*/i)
  if (match && match[1]) {
    identifiers.add(match[1].toLowerCase())
  }

  return identifiers
}

const optionMatchesValue = (option: string | any, value: string | number | undefined) => {
  if (value === undefined || value === null) return false
  const valueString = value.toString().trim().toLowerCase()
  if (!valueString) return false

  const identifiers = getOptionIdentifiers(option)
  return identifiers.has(valueString)
}

const isOptionCorrect = (question: Question, option: string | any) => {
  return (question.correct || []).some((value) => optionMatchesValue(option, value))
}

const removeOptionMatches = (correct: any[] = [], option: string | any) => {
  return correct.filter((value) => !optionMatchesValue(option, value))
}

interface QuestionEditorProps {
  questions: Question[]
  onQuestionsUpdate: (questions: Question[]) => void
  mode?: 'create' | 'edit'
}

const QUESTION_TYPES: Array<{ label: string; value: Question['type'] }> = [
  { label: 'Single Choice', value: 'mcq_single' },
  { label: 'Multiple Choice', value: 'mcq_multi' },
  { label: 'True / False', value: 'true_false' },
  { label: 'Numeric', value: 'numeric' },
  { label: 'Descriptive', value: 'descriptive' }
]

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions,
  onQuestionsUpdate,
  mode = 'create'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isResetting, setIsResetting] = useState(false)
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null)

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length

  const canDuplicate = totalQuestions > 0
  const canDelete = totalQuestions > 1

  const handleQuestionChange = (questionId: string, updates: Partial<Question>) => {
    const updated = questions.map((question) =>
      question.id === questionId ? { ...question, ...updates } : question
    )
    onQuestionsUpdate(updated)
  }

  const handleOptionChange = (questionId: string, optionIndex: number, value: string) => {
    const target = questions.find((question) => question.id === questionId)
    if (!target) return

    const options = [...target.options]
    const previousValue = options[optionIndex]
    options[optionIndex] = value

    let correct = (target.correct || []).map((answer) =>
      previousValue && optionMatchesValue(previousValue, answer) ? value : answer
    )

    if (target.type === 'mcq_single' || target.type === 'mcq_multi') {
      const optionSet = new Set(options)
      correct = correct.filter((answer) => optionSet.has(answer))
    }

    handleQuestionChange(questionId, { options, correct: Array.from(new Set(correct)) })
  }

  const handleAddOption = (questionId: string) => {
    const target = questions.find((question) => question.id === questionId)
    if (!target) return

    if (target.options.length >= 8) {
      toast.error('Maximum of 8 options allowed')
      return
    }

    handleQuestionChange(questionId, {
      options: [...target.options, '']
    })
  }

  const handleRemoveOption = (questionId: string, optionIndex: number) => {
    const target = questions.find((question) => question.id === questionId)
    if (!target) return

    if (target.options.length <= 2) {
      toast.error('At least two options are required')
      return
    }

    const options = target.options.filter((_, index) => index !== optionIndex)
    const correct = target.correct.filter((value) => value !== target.options[optionIndex])

    handleQuestionChange(questionId, { options, correct })
  }

  const handleCorrectToggle = (questionId: string, option: string) => {
    const target = questions.find((question) => question.id === questionId)
    if (!target) return

    if (target.type === 'descriptive' || target.type === 'numeric') {
      handleQuestionChange(questionId, { correct: [option] })
      return
    }

    const currentlySelected = isOptionCorrect(target, option)

    if (target.type === 'mcq_single' || target.type === 'true_false') {
      handleQuestionChange(questionId, { correct: currentlySelected ? [] : [option] })
      return
    }

    const base = removeOptionMatches(target.correct, option)
    const updated = currentlySelected ? base : [...base, option]

    handleQuestionChange(questionId, { correct: Array.from(new Set(updated)) })
  }

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `new-${Date.now()}`,
      type: 'mcq_single',
      text: '',
      options: ['', '', '', ''],
      correct: [],
      marks: 1,
      negative_marks: 0
    }
    onQuestionsUpdate([...questions, newQuestion])
    setCurrentIndex(questions.length)
  }

  const handleDuplicateQuestion = () => {
    if (!canDuplicate || !currentQuestion) return

    const duplicated: Question = {
      ...currentQuestion,
      id: `dup-${Date.now()}`
    }

    const updated = [...questions]
    updated.splice(currentIndex + 1, 0, duplicated)
    onQuestionsUpdate(updated)
    setCurrentIndex(currentIndex + 1)

    toast.success('Question duplicated')
  }

  const handleDeleteQuestion = () => {
    if (!canDelete) {
      toast.error('At least one question is required')
      return
    }

    const updated = questions.filter((_, index) => index !== currentIndex)
    onQuestionsUpdate(updated)
    setCurrentIndex(Math.max(currentIndex - 1, 0))

    toast.success('Question removed')
  }

  const handleReorder = (direction: 'previous' | 'next') => {
    const targetIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= questions.length) return

    const updated = [...questions]
    ;[updated[currentIndex], updated[targetIndex]] = [updated[targetIndex], updated[currentIndex]]
    onQuestionsUpdate(updated)
    setCurrentIndex(targetIndex)
  }

  const resetQuestion = () => {
    if (!currentQuestion) return

    setIsResetting(true)
    setTimeout(() => {
      handleQuestionChange(currentQuestion.id, {
        text: '',
        options: ['', '', '', ''],
        correct: [],
        marks: 1,
        negative_marks: 0
      })
      setIsResetting(false)
    }, 200)
  }

  const summary = useMemo(() => {
    const attempted = questions.filter((question) => question.text.trim().length > 0).length
    return {
      total: questions.length,
      attempted
    }
  }, [questions])

  if (!currentQuestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Question Editor</CardTitle>
          <CardDescription>No questions available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const applyTypeDefaults = (type: Question['type']): Partial<Question> => {
    switch (type) {
      case 'true_false':
        return { options: ['True', 'False'], correct: [] }
      case 'numeric':
        return { options: [], correct: [''] }
      case 'descriptive':
        return { options: [], correct: [''] }
      default:
        return {}
    }
  }

  const handleQuestionTypeChange = (questionId: string, type: Question['type']) => {
    const defaults = applyTypeDefaults(type)
    handleQuestionChange(questionId, {
      type,
      ...defaults
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Question Editor</CardTitle>
          <CardDescription>
            Review and edit the parsed questions ({summary.attempted}/{summary.total} ready)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span>Question {currentIndex + 1} of {totalQuestions}</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center space-x-1">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span>Ensure each question has marks and correct answers where applicable.</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleAddQuestion}>
              <Plus className="h-4 w-4 mr-2" /> Add Question
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicateQuestion} disabled={!canDuplicate}>
              <Copy className="h-4 w-4 mr-2" /> Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteQuestion} disabled={!canDelete}>
              <Delete className="h-4 w-4 mr-2" /> Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleReorder('previous')} disabled={currentIndex === 0}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Move Up
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleReorder('next')} disabled={currentIndex === questions.length - 1}>
              Move Down <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetQuestion} disabled={isResetting}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Question Text
            </label>
            <textarea
              value={currentQuestion.text}
              onChange={(event) => handleQuestionChange(currentQuestion.id, { text: event.target.value })}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Enter the question text"
            />
            {currentQuestion.diagram?.present && currentQuestion.diagram?.url && (
              <div className="mt-2">
                <img 
                  src={currentQuestion.diagram.url} 
                  alt="Question diagram"
                  className="max-w-full h-auto max-h-60 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setModalImage({ 
                    src: currentQuestion.diagram!.url!, 
                    alt: currentQuestion.diagram?.description || 'Question diagram' 
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {currentQuestion.diagram.description || 'Diagram from PDF'} <span className="text-blue-600">(Click to enlarge)</span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
              <select
                value={currentQuestion.type}
                onChange={(event) => handleQuestionTypeChange(currentQuestion.id, event.target.value as Question['type'])}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {QUESTION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                <Input
                  type="number"
                  min="0"
                  value={currentQuestion.marks ?? 1}
                  onChange={(event) => handleQuestionChange(currentQuestion.id, { marks: Number(event.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks</label>
                <Input
                  type="number"
                  value={currentQuestion.negative_marks ?? 0}
                  onChange={(event) => handleQuestionChange(currentQuestion.id, { negative_marks: Number(event.target.value) })}
                />
              </div>
            </div>
          </div>

          {currentQuestion.type === 'true_false' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Correct Answer</label>
              <div className="flex items-center gap-4">
                {['True', 'False'].map((option) => (
                  <label key={option} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={`true-false-${currentQuestion.id}`}
                      checked={isOptionCorrect(currentQuestion, option)}
                      onChange={() => handleCorrectToggle(currentQuestion.id, option)}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentQuestion.type === 'numeric' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Correct Numeric Answer</label>
              <Input
                type="number"
                value={currentQuestion.correct[0] ?? ''}
                onChange={(event) => handleQuestionChange(currentQuestion.id, { correct: [event.target.value] })}
              />
            </div>
          )}

          {currentQuestion.type === 'descriptive' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Answer Notes</label>
              <textarea
                value={currentQuestion.correct[0] ?? ''}
                onChange={(event) => handleQuestionChange(currentQuestion.id, { correct: [event.target.value] })}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Optional notes or guidance for manual grading"
              />
            </div>
          )}

          {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Options</label>
                <Button variant="outline" size="sm" onClick={() => handleAddOption(currentQuestion.id)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Option
                </Button>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const optionLabel = getOptionLabel(option)
                  const optionText = getOptionText(option)
                  const hasDiagram = hasOptionDiagram(option)
                  const diagramUrl = getOptionDiagramUrl(option)
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-start gap-2">
                        {currentQuestion.type === 'mcq_multi' ? (
                          <input
                            type="checkbox"
                            checked={isOptionCorrect(currentQuestion, option)}
                            onChange={() => handleCorrectToggle(currentQuestion.id, optionLabel)}
                            className="mt-2"
                          />
                        ) : (
                          <input
                            type="radio"
                            name={`correct-${currentQuestion.id}`}
                            checked={isOptionCorrect(currentQuestion, option)}
                            onChange={() => handleCorrectToggle(currentQuestion.id, optionLabel)}
                            className="mt-2"
                          />
                        )}
                        <div className="flex-1">
                          <Input
                            value={optionText}
                            onChange={(event) => handleOptionChange(currentQuestion.id, index, event.target.value)}
                            placeholder={`Option ${optionLabel || index + 1}`}
                          />
                          {hasDiagram && diagramUrl && (
                            <div className="mt-2">
                              <img 
                                src={diagramUrl} 
                                alt={`Option ${optionLabel} diagram`}
                                className="max-w-full h-auto max-h-40 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setModalImage({ 
                                  src: diagramUrl, 
                                  alt: `Option ${optionLabel} - Diagram` 
                                })}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Diagram from PDF <span className="text-blue-600">(Click to enlarge)</span>
                              </p>
                            </div>
                          )}
                        </div>
                        {currentQuestion.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(currentQuestion.id, index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentIndex(Math.max(currentIndex - 1, 0))} disabled={currentIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-2" /> Previous Question
        </Button>
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(Math.min(currentIndex + 1, questions.length - 1))}
          disabled={currentIndex === questions.length - 1}
        >
          Next Question <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <ImageModal 
        src={modalImage?.src || ''} 
        alt={modalImage?.alt || ''} 
        isOpen={!!modalImage} 
        onClose={() => setModalImage(null)} 
      />
    </div>
  )
}

export default QuestionEditor

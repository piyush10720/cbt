import React, { useState } from 'react'
import { Question } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  ChevronUp as MoveUp,
  ChevronDown as MoveDown,
  CheckCircle,
  AlertCircle,
  Wand2,
  Upload as UploadIcon,
  X
} from 'lucide-react'
import { getOptionLabel, getOptionText, hasOptionDiagram, getOptionDiagramUrl } from '@/utils/questionHelpers'
import ImageModal from '@/components/ImageModal'
import MathText from '@/components/MathText'
import { autoFixLatex, detectMissingBackslashes } from '@/utils/latexHelpers'
import toast from 'react-hot-toast'

const QUESTION_TYPES: Array<{ label: string; value: Question['type'] }> = [
  { label: 'Single Choice', value: 'mcq_single' },
  { label: 'Multiple Choice', value: 'mcq_multi' },
  { label: 'True / False', value: 'true_false' },
  { label: 'Numeric', value: 'numeric' },
  { label: 'Descriptive', value: 'descriptive' }
]

interface CollapsibleQuestionCardProps {
  question: Question
  index: number
  totalQuestions: number
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: (questionId: string, updates: Partial<Question>) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocus: () => void
}

const CollapsibleQuestionCard: React.FC<CollapsibleQuestionCardProps> = ({
  question,
  index,
  totalQuestions,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onFocus
}) => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null)

  const isComplete = question.text.trim().length > 0 && question.correct && question.correct.length > 0

  // Debug diagram data
  React.useEffect(() => {
    if (question.diagram && isExpanded) {
      console.log(`Question ${index + 1} diagram data:`, {
        present: question.diagram.present,
        url: question.diagram.url,
        hasUrl: !!question.diagram.url,
        description: question.diagram.description
      })
    }
  }, [question.diagram, isExpanded, index])

  const handleOptionChange = (optionIndex: number, value: string) => {
    const options = [...question.options]
    const previousValue = options[optionIndex]
    options[optionIndex] = value

    let correct = (question.correct || []).map((answer) => {
      if (previousValue && answer === previousValue) {
        return value
      }
      return answer
    })

    onEdit(question.id, { options, correct: Array.from(new Set(correct)) })
  }

  const handleAddOption = () => {
    if (question.options.length >= 8) {
      return
    }
    onEdit(question.id, { options: [...question.options, ''] })
  }

  const handleRemoveOption = (optionIndex: number) => {
    if (question.options.length <= 2) {
      return
    }
    const options = question.options.filter((_, index) => index !== optionIndex)
    const correct = question.correct.filter((value) => value !== question.options[optionIndex])
    onEdit(question.id, { options, correct })
  }

  const handleCorrectToggle = (option: string) => {
    if (question.type === 'descriptive' || question.type === 'numeric') {
      onEdit(question.id, { correct: [option] })
      return
    }

    const currentlySelected = question.correct.includes(option)

    if (question.type === 'mcq_single' || question.type === 'true_false') {
      onEdit(question.id, { correct: currentlySelected ? [] : [option] })
      return
    }

    const updated = currentlySelected
      ? question.correct.filter((c) => c !== option)
      : [...question.correct, option]

    onEdit(question.id, { correct: Array.from(new Set(updated)) })
  }

  const handleQuestionTypeChange = (type: Question['type']) => {
    let updates: Partial<Question> = { type }

    switch (type) {
      case 'true_false':
        updates.options = ['True', 'False']
        updates.correct = []
        break
      case 'numeric':
        updates.options = []
        updates.correct = ['']
        break
      case 'descriptive':
        updates.options = []
        updates.correct = ['']
        break
    }

    onEdit(question.id, updates)
  }

  const handleAutoFixLatex = () => {
    const fixedText = autoFixLatex(question.text)
    if (fixedText !== question.text) {
      onEdit(question.id, { text: fixedText })
      toast.success('LaTeX auto-fixed! Check the preview.')
    } else {
      toast.success('No LaTeX issues detected')
    }
  }

  const handleDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    try {
      // Convert image to base64 data URL for preview
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        onEdit(question.id, {
          diagram: {
            present: true,
            url: dataUrl,
            description: 'User uploaded diagram',
            uploaded_at: new Date().toISOString()
          }
        })
        toast.success('Diagram uploaded successfully')
      }
      reader.onerror = () => {
        toast.error('Failed to read image file')
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Diagram upload error:', error)
      toast.error('Failed to upload diagram')
    }
  }

  const handleRemoveDiagram = () => {
    onEdit(question.id, {
      diagram: {
        present: false,
        url: undefined,
        description: undefined
      }
    })
    toast.success('Diagram removed')
  }

  const questionPreview = question.text.substring(0, 100) + (question.text.length > 100 ? '...' : '')

  return (
    <Card className={`mb-4 ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="py-3 px-4 cursor-pointer hover:bg-gray-50" onClick={onToggleExpand}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
              <span className="font-semibold text-sm">Q{index + 1}</span>
            </div>

            <div className="flex-1">
              {isExpanded ? (
                <span className="text-sm font-medium">Question {index + 1}</span>
              ) : (
                <div>
                  {questionPreview ? (
                    <MathText text={questionPreview} className="text-sm text-gray-700" />
                  ) : (
                    <p className="text-sm text-gray-700">(Empty question)</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {QUESTION_TYPES.find((t) => t.value === question.type)?.label} • {question.marks} marks
                    </span>
                    {question.sourcePageNumber && (
                      <span className="text-xs text-blue-600">• Page {question.sourcePageNumber}</span>
                    )}
                    {question.diagram?.present && (
                      <span className="text-xs text-purple-600">• Has diagram</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isComplete ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-4 py-4 space-y-4" onClick={onFocus}>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-4 w-4 mr-1" /> Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }} disabled={totalQuestions <= 1}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}>
              <MoveUp className="h-4 w-4 mr-1" /> Move Up
            </Button>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === totalQuestions - 1}>
              <MoveDown className="h-4 w-4 mr-1" /> Move Down
            </Button>
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Question Text
              </label>
              {detectMissingBackslashes(question.text) && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); handleAutoFixLatex(); }}
                  className="text-xs"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Fix LaTeX
                </Button>
              )}
            </div>
            <textarea
              value={question.text}
              onChange={(e) => onEdit(question.id, { text: e.target.value })}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
              placeholder="Enter question text (e.g., Let $A$ be a $2 \\times 2$ matrix)"
              onClick={(e) => e.stopPropagation()}
            />
            {question.text && (question.text.includes('$') || question.text.includes('\\')) && (
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <p className="text-xs font-medium text-gray-600 mb-2">Preview with LaTeX rendering:</p>
                <div className="text-sm leading-relaxed">
                  <MathText text={question.text} block />
                </div>
              </div>
            )}
            {question.diagram?.present && question.diagram?.url ? (
              <div className="mt-2">
                <div className="relative group">
                  <img
                    src={question.diagram.url}
                    alt="Question diagram"
                    className="max-w-full h-auto max-h-60 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      setModalImage({
                        src: question.diagram!.url!,
                        alt: question.diagram?.description || 'Question diagram'
                      })
                    }}
                    onError={(e) => {
                      console.error('Failed to load diagram:', question.diagram?.url)
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleRemoveDiagram(); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    {question.diagram.description || 'Diagram from PDF'} <span className="text-blue-600">(Click to enlarge)</span>
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDiagramUpload}
                        className="hidden"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <UploadIcon className="h-3 w-3 mr-1" />
                      Replace
                    </label>
                  </Button>
                </div>
              </div>
            ) : question.diagram?.present && !question.diagram?.url ? (
              <div className="mt-2 space-y-2">
                <div className="p-2 border border-yellow-200 bg-yellow-50 rounded text-xs text-yellow-700">
                  Diagram detected but URL missing. Upload a diagram manually.
                </div>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDiagramUpload}
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload Diagram
                  </label>
                </Button>
              </div>
            ) : (
              <div className="mt-2">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDiagramUpload}
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Add Diagram
                  </label>
                </Button>
              </div>
            )}
          </div>

          {/* Question Type and Marks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
              <select
                value={question.type}
                onChange={(e) => handleQuestionTypeChange(e.target.value as Question['type'])}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => e.stopPropagation()}
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
                  value={question.marks ?? 1}
                  onChange={(e) => onEdit(question.id, { marks: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks</label>
                <Input
                  type="number"
                  value={question.negative_marks ?? 0}
                  onChange={(e) => onEdit(question.id, { negative_marks: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>

          {/* MCQ Options */}
          {(question.type === 'mcq_single' || question.type === 'mcq_multi') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Options</label>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleAddOption(); }}>
                  Add Option
                </Button>
              </div>

              <div className="space-y-3">
                {question.options.map((option, idx) => {
                  const optionLabel = getOptionLabel(option)
                  const optionText = getOptionText(option)
                  const hasDiagram = hasOptionDiagram(option)
                  const diagramUrl = getOptionDiagramUrl(option)

                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-start gap-2">
                        {question.type === 'mcq_multi' ? (
                          <input
                            type="checkbox"
                            checked={question.correct.includes(optionLabel)}
                            onChange={() => handleCorrectToggle(optionLabel)}
                            className="mt-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correct.includes(optionLabel)}
                            onChange={() => handleCorrectToggle(optionLabel)}
                            className="mt-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="flex-1">
                          <Input
                            value={optionText}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Option ${optionLabel || idx + 1} (supports LaTeX)`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono"
                          />
                          {optionText && (optionText.includes('$') || optionText.includes('\\')) && (
                            <div className="mt-1 p-2 border border-gray-200 rounded bg-gray-50 text-sm">
                              <MathText text={optionText} />
                            </div>
                          )}
                          {hasDiagram && diagramUrl ? (
                            <div className="mt-2">
                              <img
                                src={diagramUrl}
                                alt={`Option ${optionLabel} diagram`}
                                className="max-w-full h-auto max-h-40 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setModalImage({
                                    src: diagramUrl,
                                    alt: `Option ${optionLabel} - Diagram`
                                  })
                                }}
                                onError={(e) => {
                                  console.error(`Failed to load option ${optionLabel} diagram:`, diagramUrl)
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Diagram from PDF <span className="text-blue-600">(Click to enlarge)</span>
                              </p>
                            </div>
                          ) : hasDiagram && !diagramUrl ? (
                            <div className="mt-2 p-1 border border-yellow-200 bg-yellow-50 rounded text-xs text-yellow-700">
                              Diagram detected but not loaded
                            </div>
                          ) : null}
                        </div>
                        {question.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleRemoveOption(idx); }}
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

          {/* True/False */}
          {question.type === 'true_false' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Correct Answer</label>
              <div className="flex items-center gap-4">
                {['True', 'False'].map((option) => (
                  <label key={option} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={`true-false-${question.id}`}
                      checked={question.correct.includes(option)}
                      onChange={() => handleCorrectToggle(option)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Numeric */}
          {question.type === 'numeric' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Correct Numeric Answer</label>
              <Input
                type="number"
                step="any"
                value={question.correct && question.correct.length > 0 ? question.correct[0] : ''}
                onChange={(e) => onEdit(question.id, { correct: [e.target.value] })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Enter the correct numeric answer"
              />
            </div>
          )}

          {/* Descriptive */}
          {question.type === 'descriptive' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Answer Notes</label>
              <textarea
                value={question.correct[0] ?? ''}
                onChange={(e) => onEdit(question.id, { correct: [e.target.value] })}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Optional notes or guidance for manual grading"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </CardContent>
      )}

      <ImageModal
        src={modalImage?.src || ''}
        alt={modalImage?.alt || ''}
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
      />
    </Card>
  )
}

export default CollapsibleQuestionCard


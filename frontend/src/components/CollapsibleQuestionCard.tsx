import React, { useState, useMemo, memo } from 'react'
import { Question } from '@/lib/api'
import { imageUploadAPI } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  ChevronUp as MoveUp,
  ChevronDown as MoveDown,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
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

interface ValidationError {
  field: string
  message: string
}

interface CollapsibleQuestionCardProps {
  question: Question
  index: number
  totalQuestions: number
  isExpanded: boolean
  isFocused?: boolean
  validationErrors?: ValidationError[]
  onToggleExpand: () => void
  onEdit: (questionId: string, updates: Partial<Question>) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocus: () => void
}

const CollapsibleQuestionCard: React.FC<CollapsibleQuestionCardProps> = memo(({
  question,
  index,
  totalQuestions,
  isExpanded,
  isFocused = false,
  validationErrors = [],
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onFocus
}) => {
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null)
  const [uploadingDiagram, setUploadingDiagram] = useState(false)
  const [uploadingOptionDiagram, setUploadingOptionDiagram] = useState<number | null>(null)

  const [isTagsVisible, setIsTagsVisible] = useState(false)
  const [editingLabelIndex, setEditingLabelIndex] = useState<number | null>(null)

  const isComplete = question.text.trim().length > 0 && question.correct && question.correct.length > 0
  const hasErrors = validationErrors.length > 0
  
  // Count options with diagrams
  const optionDiagramCount = useMemo(() => {
    return question.options.filter(opt => hasOptionDiagram(opt)).length
  }, [question.options])

  const handleOptionChange = (optionIndex: number, value: string) => {
    const options = [...question.options]
    const currentOption = options[optionIndex]
    
    // Preserve existing object structure if it exists
    if (typeof currentOption === 'object' && currentOption !== null) {
      options[optionIndex] = { ...currentOption, text: value }
    } else {
      // If it was a string, we can keep it as a string OR convert to object
      // Let's keep as string for simplicity unless we need label/diagram
      options[optionIndex] = value
    }

    // Note: Changing text doesn't affect correct answer matching if matching is done by label
    // But if matching is done by value (for string options), we need to update correct array
    
    // If option is a string, its value IS its identifier.
    // If option is object, its identifier is its label.
    
    if (typeof currentOption === 'string') {
      const previousValue = currentOption
      let correct = (question.correct || []).map((answer) => {
        if (previousValue && answer === previousValue) {
          return value
        }
        return answer
      })
      onEdit(question.id, { options, correct: Array.from(new Set(correct)) })
    } else {
      // For object options, changing text doesn't change the label/identifier
      onEdit(question.id, { options })
    }
  }

  const handleOptionLabelChange = (optionIndex: number, newLabel: string) => {
    const options = [...question.options]
    const currentOption = options[optionIndex]
    const oldLabel = getOptionLabel(currentOption)
    
    // Ensure option is an object
    if (typeof currentOption === 'string') {
      options[optionIndex] = { label: newLabel, text: currentOption }
    } else {
      options[optionIndex] = { ...currentOption, label: newLabel }
    }
    
    // Update correct answers list if this option was selected
    let correct = (question.correct || []).map((answer) => {
      if (answer === oldLabel) {
        return newLabel
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

    setUploadingDiagram(true)

    try {
      // Upload to Cloudinary via backend
      const response = await imageUploadAPI.uploadDiagram(file, {
        type: 'question',
        questionId: question.id
      })

      const cloudinaryUrl = response.data.data.url

      onEdit(question.id, {
        diagram: {
          present: true,
          url: cloudinaryUrl,
          description: 'User uploaded diagram',
          uploaded_at: new Date().toISOString()
        }
      })
      toast.success('Diagram uploaded to cloud storage')
    } catch (error) {
      console.error('Diagram upload error:', error)
      toast.error('Failed to upload diagram')
    } finally {
      setUploadingDiagram(false)
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

  const handleOptionDiagramUpload = async (optionIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const currentOption = question.options[optionIndex]
    const optionLabel = getOptionLabel(currentOption)
    
    setUploadingOptionDiagram(optionIndex)

    try {
      // Upload to Cloudinary via backend
      const response = await imageUploadAPI.uploadDiagram(file, {
        type: 'option',
        questionId: question.id,
        optionLabel: optionLabel
      })

      const cloudinaryUrl = response.data.data.url
      
      // Update the option to include diagram
      const updatedOptions = [...question.options]
      const optionText = getOptionText(currentOption)
      
      updatedOptions[optionIndex] = {
        label: optionLabel,
        text: optionText,
        diagram: {
          present: true,
          url: cloudinaryUrl,
          description: `Option ${optionLabel} diagram`,
          uploaded_at: new Date().toISOString()
        }
      }
      
      onEdit(question.id, { options: updatedOptions })
      toast.success(`Diagram uploaded to cloud storage`)
    } catch (error) {
      console.error('Option diagram upload error:', error)
      toast.error('Failed to upload diagram')
    } finally {
      setUploadingOptionDiagram(null)
    }
  }

  const handleRemoveOptionDiagram = (optionIndex: number) => {
    const updatedOptions = [...question.options]
    const currentOption = updatedOptions[optionIndex]
    const optionLabel = getOptionLabel(currentOption)
    const optionText = getOptionText(currentOption)
    
    // Remove diagram but keep option text
    updatedOptions[optionIndex] = typeof currentOption === 'string' 
      ? currentOption 
      : {
          label: optionLabel,
          text: optionText,
          diagram: {
            present: false,
            url: undefined,
            description: undefined
          }
        }
    
    onEdit(question.id, { options: updatedOptions })
    toast.success(`Diagram removed from option ${optionLabel}`)
  }

  const questionPreview = question.text.substring(0, 100) + (question.text.length > 100 ? '...' : '')

  return (
    <Card className={`mb-4 ${
      hasErrors ? 'ring-2 ring-red-500 border-red-300' : 
      isExpanded && isFocused ? 'ring-2 ring-blue-600 shadow-lg' : 
      isExpanded ? 'ring-1 ring-blue-300' : ''
    }`}>
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
                      {(question as any).negative_marking_scheme && (question as any).negative_marking_scheme !== 'none' && (
                        <span className="text-red-600 ml-1">
                          (−{Math.abs(question.negative_marks).toFixed(2)})
                        </span>
                      )}
                    </span>
                    {question.sourcePageNumber && (
                      <span className="text-xs text-blue-600">• Page {question.sourcePageNumber}</span>
                    )}
                    {question.diagram?.present && (
                      <span className="text-xs text-purple-600">• Q diagram</span>
                    )}
                    {optionDiagramCount > 0 && (
                      <span className="text-xs text-purple-600">• {optionDiagramCount} opt diagram{optionDiagramCount > 1 ? 's' : ''}</span>
                    )}
                    {hasErrors && (
                      <span className="text-xs text-red-600 font-medium">• {validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {hasErrors ? (
                <div title={`${validationErrors.length} validation error${validationErrors.length !== 1 ? 's' : ''}`}>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              ) : isComplete ? (
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
          {/* Validation Errors */}
          {hasErrors && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
              <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {validationErrors.length} Validation Error{validationErrors.length !== 1 ? 's' : ''}
              </p>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{error.field}:</span> {error.message.replace(`Question ${index + 1}: `, '')}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-600 mt-2 font-medium">
                ⚠️ Fix these issues before creating the exam
              </p>
            </div>
          )}

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
                  {uploadingDiagram ? (
                    <Button variant="outline" size="sm" disabled>
                      <LoadingSpinner size="sm" />
                      <span className="ml-1">Uploading...</span>
                    </Button>
                  ) : (
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
                  )}
                </div>
              </div>
            ) : question.diagram?.present && !question.diagram?.url ? (
              <div className="mt-2 space-y-2">
                <div className="p-2 border border-yellow-200 bg-yellow-50 rounded text-xs text-yellow-700">
                  Diagram detected but URL missing. Upload a diagram manually.
                </div>
                {uploadingDiagram ? (
                  <Button variant="outline" size="sm" disabled className="w-full">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Uploading to cloud...</span>
                  </Button>
                ) : (
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
                )}
              </div>
            ) : (
              <div className="mt-2">
                {uploadingDiagram ? (
                  <Button variant="outline" size="sm" disabled className="w-full">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Uploading...</span>
                  </Button>
                ) : (
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
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div 
              className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 select-none"
              onClick={() => setIsTagsVisible(!isTagsVisible)}
            >
              {isTagsVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span>Tags</span>
              <span className="text-xs text-gray-500 font-normal">(comma separated)</span>
            </div>
            
            {isTagsVisible && (
              <Input
                defaultValue={question.tags?.join(', ') || ''}
                key={question.id + '-tags'} // Re-render when question changes
                onBlur={(e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  onEdit(question.id, { tags })
                }}
                placeholder="e.g. Algebra, 2023, Hard"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
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
                  step="0.5"
                  value={question.marks ?? 1}
                  onChange={(e) => {
                    const newMarks = Number(e.target.value)
                    const updates: any = { marks: newMarks }
                    
                    // Recalculate negative marks if using a scheme
                    const scheme = (question as any).negative_marking_scheme
                    if (scheme && scheme !== 'none' && scheme !== 'custom') {
                      const fraction = scheme === '1/4' ? 0.25 
                        : scheme === '1/3' ? 0.333
                        : scheme === '1/2' ? 0.5
                        : 0
                      updates.negative_marks = -Math.abs(newMarks * fraction)
                    }
                    
                    onEdit(question.id, updates)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Negative Marks
                  {(question as any).negative_marking_scheme && (question as any).negative_marking_scheme !== 'none' && (
                    <span className="text-xs text-gray-500 ml-1">
                      ({(question as any).negative_marking_scheme === 'custom' ? 'Custom' : (question as any).negative_marking_scheme})
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  value={question.negative_marks ?? 0}
                  onChange={(e) => onEdit(question.id, { negative_marks: Number(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="text-red-600 font-medium"
                />
                {(question as any).negative_marking_scheme && (question as any).negative_marking_scheme !== 'none' && (question as any).negative_marking_scheme !== 'custom' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-calculated: {(question as any).negative_marking_scheme} of {Number(question.marks).toFixed(2)} marks = {Number(question.negative_marks).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* MCQ Options */}
          {(question.type === 'mcq_single' || question.type === 'mcq_multi') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Options</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Click <UploadIcon className="h-3 w-3 inline mx-0.5" /> icon to add/replace diagram for each option
                  </p>
                </div>
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
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={optionText}
                                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                                        placeholder={`Option ${optionLabel || idx + 1} (supports LaTeX)`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="font-mono flex-1"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingLabelIndex(editingLabelIndex === idx ? null : idx)
                                        }}
                                        title="Edit Label"
                                    >
                                        {editingLabelIndex === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </div>
                                {editingLabelIndex === idx && (
                                    <div className="flex items-center gap-2 pl-1">
                                        <span className="text-xs text-gray-500 w-12">Label:</span>
                                        <Input
                                            value={optionLabel}
                                            onChange={(e) => handleOptionLabelChange(idx, e.target.value)}
                                            placeholder="Label (e.g., A)"
                                            className="h-7 text-xs w-24"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                )}
                            </div>
                            {/* Diagram Upload Button */}
                            {uploadingOptionDiagram === idx ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                disabled
                                title="Uploading..."
                              >
                                <LoadingSpinner size="sm" />
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                asChild
                                title={hasDiagram ? "Replace diagram" : "Add diagram"}
                              >
                                <label className="cursor-pointer px-2">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleOptionDiagramUpload(idx, e)}
                                    className="hidden"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <UploadIcon className="h-4 w-4 text-gray-500 hover:text-blue-500" />
                                </label>
                              </Button>
                            )}
                          </div>
                          
                          {optionText && (optionText.includes('$') || optionText.includes('\\')) && (
                            <div className="p-2 border border-gray-200 rounded bg-gray-50 text-sm">
                              <MathText text={optionText} />
                            </div>
                          )}
                          
                          {hasDiagram && diagramUrl ? (
                            <div className="relative group">
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
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleRemoveOptionDiagram(idx); 
                                }}
                                title="Remove diagram"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <p className="text-xs text-gray-500 mt-1">
                                Diagram <span className="text-blue-600">(Click to enlarge)</span>
                              </p>
                            </div>
                          ) : hasDiagram && !diagramUrl ? (
                            <div className="p-1 border border-yellow-200 bg-yellow-50 rounded text-xs text-yellow-700">
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
                type="text"
                value={question.correct && question.correct.length > 0 ? question.correct[0] : ''}
                onChange={(e) => onEdit(question.id, { correct: [e.target.value] })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Single value (e.g., -5) or range (e.g., 10 to 20, -5 to 5)"
              />
              {question.correct && question.correct[0] && question.correct[0].includes(' to ') && (
                <p className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
                  Range answer: Any value between {question.correct[0].split(' to ')[0]} and {question.correct[0].split(' to ')[1]} will be accepted
                </p>
              )}
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
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these props change
  // Return true if props are equal (skip re-render), false if different (re-render)
  return (
    prevProps.question === nextProps.question &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.index === nextProps.index &&
    prevProps.validationErrors === nextProps.validationErrors
  )
})

export default CollapsibleQuestionCard



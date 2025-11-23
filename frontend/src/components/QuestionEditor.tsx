import React, { useMemo, useState, useCallback } from 'react'
import { Question } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Plus, Settings, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import PDFViewer from '@/components/PDFViewer'
import PDFErrorBoundary from '@/components/PDFErrorBoundary'
import ManualQuestionCreator from '@/components/ManualQuestionCreator'
import VirtualizedQuestionList from '@/components/VirtualizedQuestionList'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { validateAllQuestions } from '@/utils/questionValidation'

interface QuestionEditorProps {
  questions: Question[]
  onQuestionsUpdate: (questions: Question[] | ((prev: Question[]) => Question[])) => void
  pdfUrl?: string
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions,
  onQuestionsUpdate,
  pdfUrl
}) => {
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(
    new Set(questions.length > 0 ? [questions[0].id] : [])
  )
  const [mostRecentExpandedId, setMostRecentExpandedId] = useState<string | null>(
    questions.length > 0 ? questions[0].id : null
  )
  const [pdfMinimized, setPdfMinimized] = useState(false)
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [showBulkSettings, setShowBulkSettings] = useState(false)
  const [showManualCreator, setShowManualCreator] = useState(false)
  const [validationEnabled, setValidationEnabled] = useState(false)


  // Get unique pages from all expanded questions with source page numbers
  const { pagesToShow, focusPage } = useMemo(() => {
    if (expandedQuestionIds.size === 0) return { pagesToShow: [], focusPage: null }
    
    const expandedQuestions = questions.filter(q => expandedQuestionIds.has(q.id))
    const pagesSet = new Set<number>()
    
    expandedQuestions.forEach(q => {
      if (q.sourcePageNumber) {
        pagesSet.add(q.sourcePageNumber)
      }
    })
    
    const pages = Array.from(pagesSet).sort((a, b) => a - b)
    
    // Determine focus page (most recently expanded question's page)
    const mostRecentQuestion = mostRecentExpandedId 
      ? questions.find(q => q.id === mostRecentExpandedId)
      : null
    const focus = mostRecentQuestion?.sourcePageNumber || (pages.length > 0 ? pages[0] : null)
    
    return { pagesToShow: pages, focusPage: focus }
  }, [expandedQuestionIds, mostRecentExpandedId, questions])

  const totalQuestions = questions.length

  const handleQuestionChange = useCallback((questionId: string, updates: Partial<Question>) => {
    onQuestionsUpdate(prev => prev.map((question) =>
      question.id === questionId ? { ...question, ...updates } : question
    ))
  }, [onQuestionsUpdate])

  const handleAddQuestion = () => {
    setShowManualCreator(true)
  }

  const handleAddManualQuestion = useCallback((newQuestion: Question) => {
    onQuestionsUpdate(prev => [...prev, newQuestion])
    setExpandedQuestionIds(prev => new Set([...prev, newQuestion.id]))
    setMostRecentExpandedId(newQuestion.id)
    setShowManualCreator(false)
  }, [onQuestionsUpdate])

  const handleDuplicateQuestion = useCallback((index: number) => {
    onQuestionsUpdate(prev => {
      const question = prev[index]
      if (!question) return prev

      const duplicated: Question = {
        ...question,
        id: `dup-${Date.now()}`
      }

      const updated = [...prev]
      updated.splice(index + 1, 0, duplicated)
      
      // Add duplicated question to expanded list
      setExpandedQuestionIds(prevExpanded => new Set([...prevExpanded, duplicated.id]))
      setMostRecentExpandedId(duplicated.id)
      
      return updated
    })

    toast.success('Question duplicated')
  }, [onQuestionsUpdate])

  const handleDeleteQuestion = useCallback((index: number) => {
    onQuestionsUpdate(prev => {
      if (prev.length <= 1) {
        toast.error('At least one question is required')
        return prev
      }

      const deletedQuestionId = prev[index].id
      
      // Update expanded questions if deleted
      setExpandedQuestionIds(prevExpanded => {
        if (prevExpanded.has(deletedQuestionId)) {
          const next = new Set(prevExpanded)
          next.delete(deletedQuestionId)
          
          // Update most recent if it was the deleted one
          if (mostRecentExpandedId === deletedQuestionId) {
            const remaining = Array.from(next)
            setMostRecentExpandedId(remaining.length > 0 ? remaining[remaining.length - 1] : null)
          }
          
          return next
        }
        return prevExpanded
      })
      
      toast.success('Question removed')
      return prev.filter((_, i) => i !== index)
    })
  }, [onQuestionsUpdate, mostRecentExpandedId])

  const handleMoveQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    onQuestionsUpdate(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev

      const updated = [...prev]
      ;[updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]]
      return updated
    })
  }, [onQuestionsUpdate])

  const handleToggleExpand = useCallback((questionId: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        // Collapse this question
        next.delete(questionId)
      } else {
        // Expand this question and add to the list
        next.add(questionId)
        setMostRecentExpandedId(questionId)
      }
      return next
    })
  }, [])

  const handleQuestionFocus = useCallback((question: Question) => {
    // When a question is focused, make it the most recent
    setMostRecentExpandedId(question.id)
    
    // When a question is focused, navigate to its source page in PDF
    if (question.sourcePageNumber && pdfUrl) {
      setCurrentPdfPage(question.sourcePageNumber)
    }
  }, [pdfUrl])

  const handleApplyNegativeMarkingToAll = useCallback((scheme: 'none' | '1/4' | '1/3' | '1/2') => {
    onQuestionsUpdate(prev => prev.map(q => {
      const updated = { ...q } as any
      updated.negative_marking_scheme = scheme
      
      if (scheme === 'none') {
        updated.negative_marks = 0
      } else {
        const fraction = scheme === '1/4' ? 0.25
          : scheme === '1/3' ? 0.333
          : scheme === '1/2' ? 0.5
          : 0
        updated.negative_marks = -Math.abs(q.marks * fraction)
      }
      
      return updated
    }))
    
    toast.success(`Applied ${scheme === 'none' ? 'no' : scheme} negative marking to all questions`)
    setShowBulkSettings(false)
  }, [onQuestionsUpdate])

  const summary = useMemo(() => {
    const attempted = questions.filter((question) => question.text.trim().length > 0).length
    return {
      total: questions.length,
      attempted
    }
  }, [questions])

  // Validate all questions - only when enabled
  const validation = useMemo(() => {
    if (!validationEnabled) {
      return { valid: true, errors: [], questionErrors: new Map() }
    }
    return validateAllQuestions(questions)
  }, [questions, validationEnabled])

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Question Editor</CardTitle>
          <CardDescription>No questions available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleAddQuestion}>
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>
        </CardContent>
      </Card>
    )
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
            <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</span>
            <span className="hidden sm:inline">·</span>
            <span className="text-blue-600 font-medium">{expandedQuestionIds.size} expanded</span>
            {pdfUrl && expandedQuestionIds.size > 0 && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="text-purple-600 text-xs">PDF showing {pagesToShow.length} page{pagesToShow.length !== 1 ? 's' : ''}</span>
              </>
            )}
            {!validation.valid && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="text-red-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {validation.errors.length} issue{validation.errors.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          
          {pdfUrl && (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
              <span className="font-medium">💡 Tip:</span> Expand multiple questions to see all their pages in the PDF viewer. 
              The most recently selected question's page will be highlighted and centered.
            </div>
          )}
          
          {!validation.valid && (
            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
              <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Validation Issues Found
              </p>
              <ul className="text-xs text-red-700 space-y-1 ml-6 list-disc">
                {validation.errors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>{error.message}</li>
                ))}
                {validation.errors.length > 5 && (
                  <li className="text-red-600 font-medium">
                    ...and {validation.errors.length - 5} more issue{validation.errors.length - 5 !== 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center space-x-1">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span>Ensure each question has marks and correct answers where applicable.</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleAddQuestion}>
              <Plus className="h-4 w-4 mr-2" /> Add Question
            </Button>
            {expandedQuestionIds.size > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setExpandedQuestionIds(new Set())
                  setMostRecentExpandedId(null)
                }}
              >
                Collapse All
              </Button>
            )}
            {expandedQuestionIds.size < totalQuestions && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const allIds = questions.map(q => q.id)
                  setExpandedQuestionIds(new Set(allIds))
                  setMostRecentExpandedId(allIds[allIds.length - 1])
                }}
              >
                Expand All
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowBulkSettings(!showBulkSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Negative Marking Settings
            </Button>
            <Button 
              variant={validationEnabled ? "default" : "outline"}
              size="sm" 
              onClick={() => setValidationEnabled(!validationEnabled)}
            >
              {validationEnabled ? '✓ Validation On' : 'Validate All'}
            </Button>
          </div>

          {/* Bulk Settings Panel */}
          {showBulkSettings && (
            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-700">Apply Negative Marking to All Questions</p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyNegativeMarkingToAll('none')}
                >
                  No Negative Marking
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyNegativeMarkingToAll('1/4')}
                >
                  1/4 of Marks
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyNegativeMarkingToAll('1/3')}
                >
                  1/3 of Marks
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyNegativeMarkingToAll('1/2')}
                >
                  1/2 of Marks
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                This will update negative marking for all {totalQuestions} questions based on their positive marks.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Question Creator Modal */}
      {showManualCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add New Question</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManualCreator(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <ManualQuestionCreator onAddQuestion={handleAddManualQuestion} />
            </div>
          </div>
        </div>
      )}

      {/* Split Screen Layout */}
      <div className="h-[800px]">
        {pdfUrl ? (
          <PanelGroup direction="horizontal" className="h-full rounded-lg border">
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full bg-gray-50">
                <VirtualizedQuestionList
                  questions={questions}
                  expandedQuestionIds={expandedQuestionIds}
                  mostRecentExpandedId={mostRecentExpandedId}
                  validationErrors={validation.questionErrors}
                  onToggleExpand={handleToggleExpand}
                  onEdit={handleQuestionChange}
                  onDuplicate={handleDuplicateQuestion}
                  onDelete={handleDeleteQuestion}
                  onMoveUp={(index) => handleMoveQuestion(index, 'up')}
                  onMoveDown={(index) => handleMoveQuestion(index, 'down')}
                  onFocus={handleQuestionFocus}
                  height={800}
                />
              </div>
            </Panel>

            <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />

            <Panel defaultSize={50} minSize={20}>
              <div className="h-full p-4 bg-white">
                <PDFErrorBoundary>
                  <PDFViewer
                    pdfUrl={pdfUrl}
                    currentPage={currentPdfPage}
                    {...(pagesToShow ? { pagesToShow } : {})}
                    {...(focusPage ? { focusPage } : {})}
                    onPageChange={setCurrentPdfPage}
                    isMinimized={pdfMinimized}
                    onToggleMinimize={() => setPdfMinimized(!pdfMinimized)}
                  />
                </PDFErrorBoundary>
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="h-full bg-gray-50 rounded-lg border">
            <VirtualizedQuestionList
              questions={questions}
              expandedQuestionIds={expandedQuestionIds}
              mostRecentExpandedId={mostRecentExpandedId}
              validationErrors={validation.questionErrors}
              onToggleExpand={handleToggleExpand}
              onEdit={handleQuestionChange}
              onDuplicate={handleDuplicateQuestion}
              onDelete={handleDeleteQuestion}
              onMoveUp={(index) => handleMoveQuestion(index, 'up')}
              onMoveDown={(index) => handleMoveQuestion(index, 'down')}
              onFocus={handleQuestionFocus}
              height={800}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestionEditor

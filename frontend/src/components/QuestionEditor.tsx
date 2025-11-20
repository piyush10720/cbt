import React, { useMemo, useState } from 'react'
import { Question } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import CollapsibleQuestionCard from '@/components/CollapsibleQuestionCard'
import PDFViewer from '@/components/PDFViewer'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'

interface QuestionEditorProps {
  questions: Question[]
  onQuestionsUpdate: (questions: Question[]) => void
  mode?: 'create' | 'edit'
  pdfUrl?: string
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions,
  onQuestionsUpdate,
  mode = 'create',
  pdfUrl
}) => {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    questions.length > 0 ? questions[0].id : null
  )
  const [pdfMinimized, setPdfMinimized] = useState(false)
  const [currentPdfPage, setCurrentPdfPage] = useState(1)

  // Get unique pages from expanded questions with source page numbers
  const pagesToShow = useMemo(() => {
    if (!expandedQuestionId) return []
    
    const expandedQuestion = questions.find(q => q.id === expandedQuestionId)
    if (!expandedQuestion?.sourcePageNumber) return []
    
    // For now, show only the page of the expanded question
    // Could be expanded to show nearby questions' pages too
    return [expandedQuestion.sourcePageNumber]
  }, [expandedQuestionId, questions])

  const totalQuestions = questions.length

  const handleQuestionChange = (questionId: string, updates: Partial<Question>) => {
    const updated = questions.map((question) =>
      question.id === questionId ? { ...question, ...updates } : question
    )
    onQuestionsUpdate(updated)
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
    setExpandedQuestionId(newQuestion.id)
    toast.success('New question added')
  }

  const handleDuplicateQuestion = (index: number) => {
    const question = questions[index]
    if (!question) return

    const duplicated: Question = {
      ...question,
      id: `dup-${Date.now()}`
    }

    const updated = [...questions]
    updated.splice(index + 1, 0, duplicated)
    onQuestionsUpdate(updated)
    setExpandedQuestionId(duplicated.id)

    toast.success('Question duplicated')
  }

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error('At least one question is required')
      return
    }

    const updated = questions.filter((_, i) => i !== index)
    onQuestionsUpdate(updated)

    // Update expanded question if deleted
    if (questions[index].id === expandedQuestionId) {
      setExpandedQuestionId(updated[Math.max(index - 1, 0)]?.id || null)
    }

    toast.success('Question removed')
  }

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= questions.length) return

    const updated = [...questions]
    ;[updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]]
    onQuestionsUpdate(updated)
  }

  const handleToggleExpand = (questionId: string) => {
    setExpandedQuestionId((prev) => (prev === questionId ? null : questionId))
  }

  const handleQuestionFocus = (question: Question) => {
    // When a question is focused, navigate to its source page in PDF
    if (question.sourcePageNumber && pdfUrl) {
      setCurrentPdfPage(question.sourcePageNumber)
    }
  }

  const summary = useMemo(() => {
    const attempted = questions.filter((question) => question.text.trim().length > 0).length
    return {
      total: questions.length,
      attempted
    }
  }, [questions])

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
            <span className="flex items-center space-x-1">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span>Ensure each question has marks and correct answers where applicable.</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleAddQuestion}>
              <Plus className="h-4 w-4 mr-2" /> Add Question
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Split Screen Layout */}
      <div className="h-[800px]">
        {pdfUrl ? (
          <PanelGroup direction="horizontal" className="h-full rounded-lg border">
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full overflow-auto p-4 bg-gray-50">
                {questions.map((question, index) => (
                  <CollapsibleQuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    totalQuestions={totalQuestions}
                    isExpanded={expandedQuestionId === question.id}
                    onToggleExpand={() => handleToggleExpand(question.id)}
                    onEdit={handleQuestionChange}
                    onDuplicate={() => handleDuplicateQuestion(index)}
                    onDelete={() => handleDeleteQuestion(index)}
                    onMoveUp={() => handleMoveQuestion(index, 'up')}
                    onMoveDown={() => handleMoveQuestion(index, 'down')}
                    onFocus={() => handleQuestionFocus(question)}
                  />
                ))}
              </div>
            </Panel>

            <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />

            <Panel defaultSize={50} minSize={20}>
              <div className="h-full p-4 bg-white">
                <PDFViewer
                  pdfUrl={pdfUrl}
                  currentPage={currentPdfPage}
                  pagesToShow={pagesToShow}
                  onPageChange={setCurrentPdfPage}
                  isMinimized={pdfMinimized}
                  onToggleMinimize={() => setPdfMinimized(!pdfMinimized)}
                />
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="h-full overflow-auto p-4 bg-gray-50 rounded-lg border">
            {questions.map((question, index) => (
              <CollapsibleQuestionCard
                key={question.id}
                question={question}
                index={index}
                totalQuestions={totalQuestions}
                isExpanded={expandedQuestionId === question.id}
                onToggleExpand={() => handleToggleExpand(question.id)}
                onEdit={handleQuestionChange}
                onDuplicate={() => handleDuplicateQuestion(index)}
                onDelete={() => handleDeleteQuestion(index)}
                onMoveUp={() => handleMoveQuestion(index, 'up')}
                onMoveDown={() => handleMoveQuestion(index, 'down')}
                onFocus={() => handleQuestionFocus(question)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestionEditor

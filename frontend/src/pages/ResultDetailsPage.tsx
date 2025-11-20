import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'react-query'
import { resultAPI, bookmarkAPI, Question, Explanation } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { calculatePercentage, formatDate, getGradeFromPercentage, getPerformanceColor } from '@/lib/utils'
import { AlertCircle, AlertTriangle, ArrowLeft, Award, BarChart3, CheckCircle2, CircleSlash, Clock, Flag, Lightbulb, Bookmark, BookmarkCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOptionLabel, getOptionText, hasOptionDiagram, getOptionDiagramUrl } from '@/utils/questionHelpers'
import ImageModal from '@/components/ImageModal'
import MathText from '@/components/MathText'

type ResultDetailsResponse = {
  result: {
    id: string
    user: {
      name: string
      email: string
    }
    exam: {
      id: string
      title: string
      description?: string
      settings: {
        duration: number
        totalMarks: number
        passingMarks?: number
        allowReview: boolean
        showResultImmediately: boolean
      }
      questions: Array<Question & {
        correct?: string[]
      }>
    }
    attemptNumber: number
    answers: Array<{
      questionId: string
      questionText?: string
      questionType?: string
      questionOptions?: string[]
      userAnswer: any
      correctAnswer?: string[]
      isCorrect?: boolean
      marksAwarded: number
      timeSpent: number
      isMarkedForReview: boolean
    }>
    score: number
    totalMarks: number
    percentage: number
    status: 'started' | 'in_progress' | 'completed' | 'submitted' | 'auto_submitted'
    timing: {
      startedAt: string
      submittedAt?: string
      totalTimeSpent: number
    }
    analytics?: {
      correctAnswers: number
      incorrectAnswers: number
      unanswered: number
      markedForReview: number
      averageTimePerQuestion: number
    }
    feedback?: {
      strengths: string[]
      weaknesses: string[]
      recommendations: string[]
      overallComment: string
    }
  }
}

const ResultDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set())

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<ResultDetailsResponse>(
    ['result-details', id],
    async () => {
      if (!id) {
        throw new Error('Missing result identifier')
      }
      const response = await resultAPI.getResult(id, true)
      return response.data as ResultDetailsResponse
    },
    {
      enabled: !!id,
      retry: false,
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to load result details'
        toast.error(message)
      }
    }
  )

  const result = data?.result
  const exam = result?.exam

  // Fetch bookmarked questions
  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!id) return
      try {
        const response = await bookmarkAPI.checkBookmarks(id)
        setBookmarkedQuestions(new Set(response.data.bookmarkedQuestions))
      } catch (error) {
        console.error('Failed to fetch bookmarks:', error)
      }
    }
    fetchBookmarks()
  }, [id])

  const toggleBookmarkMutation = useMutation(
    async ({ questionId, resultId }: { questionId: string; resultId: string }) => {
      return bookmarkAPI.toggleBookmark({ questionId, resultId })
    },
    {
      onSuccess: (response, variables) => {
        const { bookmarked } = response.data
        setBookmarkedQuestions(prev => {
          const newSet = new Set(prev)
          if (bookmarked) {
            newSet.add(variables.questionId)
            toast.success('Question bookmarked!')
          } else {
            newSet.delete(variables.questionId)
            toast.success('Bookmark removed!')
          }
          return newSet
        })
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to toggle bookmark'
        toast.error(message)
      }
    }
  )

  const handleToggleBookmark = (questionId: string) => {
    if (!id) return
    toggleBookmarkMutation.mutate({ questionId, resultId: id })
  }

  const hasUserAnswer = (answer: any) => {
    if (answer === null || answer === undefined) {
      return false
    }

    if (Array.isArray(answer)) {
      return answer.length > 0
    }

    if (typeof answer === 'string') {
      return answer.trim().length > 0
    }

    return true
  }

  const breakdown = useMemo(() => {
    if (!result) {
      return null
    }

    const correct = result.analytics?.correctAnswers ?? result.answers.filter((answer) => answer.isCorrect).length
    const incorrect = result.analytics?.incorrectAnswers ?? result.answers.filter((answer) => answer.isCorrect === false && hasUserAnswer(answer.userAnswer)).length
    const unanswered = result.analytics?.unanswered ?? result.answers.filter((answer) => !hasUserAnswer(answer.userAnswer)).length

    return {
      correct,
      incorrect,
      unanswered,
      total: correct + incorrect + unanswered
    }
  }, [result])

  const [explanations, setExplanations] = useState<Record<string, { loading: boolean; data?: Explanation; error?: string }>>({})

  const handleExplain = async (questionId: string) => {
    if (!id) return
    setExplanations((prev) => ({
      ...prev,
      [questionId]: { loading: true, data: prev[questionId]?.data }
    }))

    try {
      const response = await resultAPI.explainAnswer(id, questionId)
      setExplanations((prev) => ({
        ...prev,
        [questionId]: { loading: false, data: response.data.explanation }
      }))
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to fetch explanation'
      setExplanations((prev) => ({
        ...prev,
        [questionId]: { loading: false, error: message }
      }))
    }
  }

  const grade = result ? getGradeFromPercentage(result.percentage) : null

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !result || !exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-800">Result not found</h1>
            <p className="text-gray-500">{(error as any)?.response?.data?.message || 'We could not load the result details.'}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const performanceColor = getPerformanceColor(result.percentage)

  const renderAnswer = (answer: any) => {
    if (!hasUserAnswer(answer)) {
      return <span className="text-gray-400 italic">No answer</span>
    }

    if (Array.isArray(answer)) {
      return answer.join(', ')
    }

    if (typeof answer === 'boolean') {
      return answer ? 'True' : 'False'
    }

    return String(answer)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Detailed Analysis</h1>
          <p className="text-sm text-gray-500">
            {exam.title} · Attempt #{result.attemptNumber}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={() => navigate(`/exams/${exam.id}`)}>
            View Exam
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Performance Summary</CardTitle>
            <CardDescription>Highlights from this attempt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Score</p>
                <p className="text-2xl font-semibold text-gray-900">{result.score} / {result.totalMarks}</p>
                <p className={`text-sm ${performanceColor}`}>Grade {grade}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Percentage</p>
                <p className="text-2xl font-semibold text-gray-900">{result.percentage}%</p>
                {exam.settings.passingMarks !== undefined && (
                  <p className="text-sm text-gray-500">
                    Passing: {calculatePercentage(exam.settings.passingMarks, exam.settings.totalMarks)}%
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Time Spent</p>
                <p className="text-2xl font-semibold text-gray-900">{formatDate(result.timing.startedAt)}</p>
                {result.timing.submittedAt && (
                  <p className="text-xs text-gray-500">Submitted {formatDate(result.timing.submittedAt)}</p>
                )}
              </div>
            </div>

            {breakdown && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 rounded-lg border border-green-200 bg-green-50 p-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Correct</p>
                    <p className="text-lg font-bold text-green-800">{breakdown.correct}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Incorrect</p>
                    <p className="text-lg font-bold text-red-800">{breakdown.incorrect}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <CircleSlash className="h-8 w-8 text-gray-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Unanswered</p>
                    <p className="text-lg font-bold text-gray-800">{breakdown.unanswered}</p>
                  </div>
                </div>
              </div>
            )}

            {result.feedback && (
              <div className="grid sm:grid-cols-3 gap-4">
                <Card className="border-green-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-green-700">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
                      {result.feedback.strengths.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-red-700">Areas to improve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
                      {result.feedback.weaknesses.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-blue-700">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
                      {result.feedback.recommendations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Exam Information</CardTitle>
              <CardDescription>High-level overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>Exam Title: <span className="text-gray-900 font-medium">{exam.title}</span></p>
              <p>Total Marks: {exam.settings.totalMarks}</p>
              <p>Passing Marks: {exam.settings.passingMarks ?? 'Not set'}</p>
              <p>Duration: {exam.settings.duration} minutes</p>
              <p>Status: {result.status}</p>
            </CardContent>
          </Card>

          {result.analytics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Analytics</CardTitle>
                <CardDescription>Timing insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600">
                <p>Correct Answers: {result.analytics.correctAnswers}</p>
                <p>Incorrect Answers: {result.analytics.incorrectAnswers}</p>
                <p>Unanswered: {result.analytics.unanswered}</p>
                <p>Average time per question: {result.analytics.averageTimePerQuestion}s</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Question-by-Question Review</span>
          </CardTitle>
          <CardDescription>Compare your answers with the correct ones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(exam.questions ?? []).length === 0 && (
            <p className="text-sm text-gray-500">Question metadata is not available for this result.</p>
          )}

          {result.answers.map((answer, index) => {
            const questionList = exam.questions ?? []
            const question = questionList.find((q) => (q._id || q.id) === answer.questionId)
            const isCorrect = answer.isCorrect
            const hasAnswer = hasUserAnswer(answer.userAnswer)
            const explanationState = explanations[answer.questionId]
            const tips = explanationState?.data?.tips ?? []

            return (
              <div
                key={answer.questionId || index}
                className={`rounded-lg border p-4 ${
                  !hasAnswer
                    ? 'border-slate-200 bg-slate-50'
                    : isCorrect === true
                    ? 'border-green-200 bg-green-50'
                    : isCorrect === false
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-semibold text-gray-800">Question {index + 1}</p>
                    <div className="text-sm text-gray-700">
                      <MathText 
                        text={answer.questionText || question?.text || 'Question text unavailable'} 
                        block 
                      />
                    </div>
                    {question?.diagram?.present && question?.diagram?.url && (
                      <div className="mt-2">
                        <img 
                          src={question.diagram.url} 
                          alt="Question diagram"
                          className="max-w-full h-auto max-h-48 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setModalImage({ 
                            src: question.diagram!.url!, 
                            alt: question.diagram?.description || 'Question diagram' 
                          })}
                        />
                        {question.diagram.description && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            {question.diagram.description} <span className="text-blue-600">(Click to enlarge)</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      size="sm"
                      variant={bookmarkedQuestions.has(answer.questionId) ? "default" : "outline"}
                      onClick={() => handleToggleBookmark(answer.questionId)}
                      disabled={toggleBookmarkMutation.isLoading}
                      className="h-8 w-8 p-0"
                      title={bookmarkedQuestions.has(answer.questionId) ? "Remove bookmark" : "Bookmark question"}
                    >
                      {bookmarkedQuestions.has(answer.questionId) ? (
                        <BookmarkCheck className="h-4 w-4" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </Button>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                      !hasAnswer
                        ? 'text-gray-500'
                        : isCorrect === true
                        ? 'text-green-600'
                        : isCorrect === false
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      {!hasAnswer
                        ? 'Unanswered'
                        : isCorrect === true
                        ? 'Correct'
                        : isCorrect === false
                        ? 'Incorrect'
                        : 'Not evaluated'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase text-gray-500">Your answer</p>
                      <p className="text-gray-800">{renderAnswer(answer.userAnswer)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-500">Correct answer</p>
                      <p className="text-gray-800">
                        {answer.correctAnswer && answer.correctAnswer.length > 0
                          ? answer.correctAnswer.join(', ')
                          : question?.type === 'descriptive'
                          ? 'Requires manual grading'
                          : 'Not available'}
                      </p>
                    </div>
                  </div>
                  
                  {question?.options && question.options.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">All Options:</p>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const optionLabel = getOptionLabel(option)
                          const optionText = getOptionText(option)
                          const hasDiagram = hasOptionDiagram(option)
                          const diagramUrl = getOptionDiagramUrl(option)
                          const isUserAnswer = Array.isArray(answer.userAnswer) 
                            ? answer.userAnswer.includes(optionLabel)
                            : answer.userAnswer === optionLabel
                          const isCorrectAnswer = answer.correctAnswer?.includes(optionLabel)
                          
                          return (
                            <div 
                              key={optionIndex} 
                              className={`flex items-start gap-2 text-sm p-2 rounded ${
                                isCorrectAnswer ? 'bg-green-50 border border-green-200' : 
                                isUserAnswer ? 'bg-red-50 border border-red-200' : 
                                'bg-gray-50'
                              }`}
                            >
                              <span className="font-medium min-w-[20px]">{optionLabel}.</span>
                              <div className="flex-1">
                                <MathText text={optionText} className="text-gray-700" />
                                {hasDiagram && diagramUrl && (
                                  <img 
                                    src={diagramUrl} 
                                    alt={`Option ${optionLabel}`}
                                    className="mt-1 max-w-full h-auto max-h-32 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setModalImage({ 
                                      src: diagramUrl, 
                                      alt: `Option ${optionLabel} - Diagram` 
                                    })}
                                  />
                                )}
                              </div>
                              {isCorrectAnswer && (
                                <span className="text-xs text-green-600 font-medium">✓ Correct</span>
                              )}
                              {isUserAnswer && !isCorrectAnswer && (
                                <span className="text-xs text-red-600 font-medium">✗ Your choice</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Award className="h-4 w-4 text-green-600" />
                    <span>Marks: {answer.marksAwarded}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>Time spent: {Math.round(answer.timeSpent)}s</span>
                  </span>
                  {answer.isMarkedForReview && (
                    <span className="flex items-center space-x-1 text-yellow-600">
                      <Flag className="h-4 w-4" />
                      <span>Marked for review</span>
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExplain(answer.questionId)}
                    disabled={explanationState?.loading}
                  >
                    {explanationState?.loading ? 'Fetching explanation…' : 'Explain Solution'}
                  </Button>

                  {explanationState?.error && (
                    <p className="mt-2 text-sm text-red-600">{explanationState.error}</p>
                  )}

                  {explanationState?.data && (
                    <div className="mt-3 space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center space-x-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          <span>Overview</span>
                        </h4>
                        <p className="text-sm text-gray-600">{explanationState.data.overview || 'No overview provided.'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">Why your answer?</h4>
                        <p className="text-sm text-gray-600">{explanationState.data.why_user_answer || 'No explanation provided.'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">Why correct answer?</h4>
                        <p className="text-sm text-gray-600">{explanationState.data.why_correct_answer || 'No explanation provided.'}</p>
                      </div>
                      {tips.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800">Tips</h4>
                          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                            {tips.map((tip, tipIndex) => (
                              <li key={tipIndex}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {result.feedback?.overallComment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instructor Feedback</CardTitle>
            <CardDescription>Summary comments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-line">{result.feedback.overallComment}</p>
          </CardContent>
        </Card>
      )}

      <ImageModal 
        src={modalImage?.src || ''} 
        alt={modalImage?.alt || ''} 
        isOpen={!!modalImage} 
        onClose={() => setModalImage(null)} 
      />
    </div>
  )
}

export default ResultDetailsPage

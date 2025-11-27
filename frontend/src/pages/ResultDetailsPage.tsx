import React, { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'react-query'
import { resultAPI, bookmarkAPI, Question, Explanation } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import {  formatDate, getGradeFromPercentage, getPerformanceColor } from '@/lib/utils'
import { 
  AlertCircle, 
  AlertTriangle, 
  ArrowLeft, 
  Award, 
  BarChart3, 
  CheckCircle2, 
  CircleSlash, 
  Clock, 
  Flag, 
  Lightbulb, 
  Bookmark, 
  BookmarkCheck, 
  XCircle, 
  Edit2, 
  Save, 
  X, 
  Plus, 
  Minus,
  Calendar,
  Timer,
  Target
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'
import { getOptionLabel, getOptionText, getOptionDiagramUrl } from '@/utils/questionHelpers'
import MathText from '@/components/MathText'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import QuestionCard from '@/components/QuestionCard'

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
      createdBy: string | { _id: string; id?: string }
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
      questionDiagram?: {
        present?: boolean
        url?: string
        description?: string
      } | null
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

  // Manual Grading Logic
  const [editingMarks, setEditingMarks] = useState<Record<string, boolean>>({})
  const [marksInput, setMarksInput] = useState<Record<string, string>>({})

  const isExamOwner = useMemo(() => {
    if (!exam || !user) return false
    const creatorId = typeof exam.createdBy === 'string' ? exam.createdBy : (exam.createdBy._id || exam.createdBy.id)
    return creatorId === user.id
  }, [exam, user])

  const gradeMutation = useMutation(
    async ({ questionId, marks }: { questionId: string; marks: number }) => {
      if (!id) throw new Error('Result ID missing')
      return resultAPI.gradeResult(id, { questionId, marksAwarded: marks })
    },
    {
      onSuccess: () => {
        toast.success('Marks updated')
        refetch()
        setEditingMarks({})
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || 'Failed to update marks')
      }
    }
  )

  const startEditing = (questionId: string, currentMarks: number) => {
    setEditingMarks(prev => ({ ...prev, [questionId]: true }))
    setMarksInput(prev => ({ ...prev, [questionId]: String(currentMarks) }))
  }

  const cancelEditing = (questionId: string) => {
    setEditingMarks(prev => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
    setMarksInput(prev => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  const saveMarks = (questionId: string) => {
    const marks = parseFloat(marksInput[questionId])
    if (isNaN(marks)) {
      toast.error('Please enter a valid number')
      return
    }
    gradeMutation.mutate({ questionId, marks })
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
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-2xl font-bold text-destructive">Result not found</h1>
            <p className="text-muted-foreground">{(error as any)?.response?.data?.message || 'We could not load the result details.'}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const performanceColor = getPerformanceColor(result.percentage)

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Hero Header */}
      <div className="relative bg-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-purple-900/90 z-0" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 z-0" />
        
        <div className="relative z-10 w-full px-4 py-12 sm:py-16">
          <Button 
            variant="ghost" 
            className="text-white/70 hover:text-white hover:bg-white/10 mb-6 pl-0"
            onClick={() => navigate('/results')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
          </Button>
          
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant={result.status === 'completed' ? "default" : "secondary"} className="bg-white/20 hover:bg-white/30 text-white border-none capitalize">
                  {result.status.replace('_', ' ')}
                </Badge>
                <span className="text-white/60 text-sm flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(result.timing.startedAt)}
                </span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{exam.title}</h1>
              <p className="text-lg text-white/80 max-w-2xl leading-relaxed">
                Attempt #{result.attemptNumber}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <div className={`text-5xl font-bold mb-1 ${
                  result.percentage >= 80 ? 'text-green-400' :
                  result.percentage >= 60 ? 'text-blue-400' :
                  result.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {Number(result.percentage).toFixed(1)}%
                </div>
                <div className="text-white/80 font-medium text-lg">Grade {grade}</div>
              </div>
              <Button 
                variant="secondary" 
                className="bg-white/10 text-white hover:bg-white/20 border-none mt-4"
                onClick={() => navigate(`/exams/${exam.id}`)}
              >
                View Exam Details
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-8 -mt-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-background/50 backdrop-blur-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Correct</p>
                    <p className="text-2xl font-bold text-green-600">{breakdown?.correct}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background/50 backdrop-blur-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Incorrect</p>
                    <p className="text-2xl font-bold text-red-600">{breakdown?.incorrect}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background/50 backdrop-blur-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                    <CircleSlash className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Unanswered</p>
                    <p className="text-2xl font-bold text-gray-600">{breakdown?.unanswered}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Question Review */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Question Review</h2>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" /> Correct
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" /> Incorrect
                  </Badge>
                </div>
              </div>

              {result.answers.map((answer, index) => {
                const questionList = exam.questions ?? []
                const question = questionList.find((q) => (q._id || q.id) === answer.questionId)
                const isCorrect = answer.isCorrect

                // Construct question object for QuestionCard
                const fetchedExplanation = explanations[answer.questionId]?.data
                
                // Format explanation from backend structure
                let explanationText: string | undefined
                if (fetchedExplanation) {
                  if (typeof fetchedExplanation === 'string') {
                    explanationText = fetchedExplanation
                  } else if (fetchedExplanation.overview) {
                    // Backend returns: { overview, why_user_answer, why_correct_answer, tips }
                    const parts = []
                    if (fetchedExplanation.overview) parts.push(fetchedExplanation.overview)
                    if (fetchedExplanation.why_user_answer) parts.push(`**Your Answer:** ${fetchedExplanation.why_user_answer}`)
                    if (fetchedExplanation.why_correct_answer) parts.push(`**Correct Answer:** ${fetchedExplanation.why_correct_answer}`)
                    if (fetchedExplanation.tips && fetchedExplanation.tips.length > 0) {
                      parts.push(`**Tips:**\n${fetchedExplanation.tips.map((tip: string) => `• ${tip}`).join('\n')}`)
                    }
                    explanationText = parts.join('\n\n')
                  }
                }
                
                const questionData = {
                  id: answer.questionId,
                  text: answer.questionText || question?.text || 'Question text unavailable',
                  type: answer.questionType || question?.type || 'mcq_single',
                  options: question?.options || answer.questionOptions || [],
                  imageUrl: answer.questionDiagram?.url || question?.diagram?.url,
                  marks: question?.marks || 1,
                  tags: question?.tags || [],
                  explanation: question?.explanation || explanationText
                }

                return (
                  <div key={answer.questionId || index} className="space-y-2">
                    <div className="flex items-center gap-2 ml-1">
                      <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                        Question {index + 1}
                      </Badge>
                    </div>
                    
                    <QuestionCard
                      question={questionData}
                      userAnswer={answer.userAnswer}
                      correctAnswer={question?.correct || answer.correctAnswer} // Pass correct answer array
                      isCorrect={isCorrect}
                      isBookmarked={bookmarkedQuestions.has(answer.questionId)}
                      onToggleBookmark={() => handleToggleBookmark(answer.questionId)}
                      
                      // Manual Grading
                      marksAwarded={answer.marksAwarded}
                      onGradeChange={(newMarks) => gradeMutation.mutate({ questionId: answer.questionId, marks: newMarks })}
                      isGradingEnabled={isExamOwner}
                      
                      showCorrectAnswer={true}
                      showUserAnswer={true}
                      showExplanation={true}
                      showTags={true}
                      
                      // AI Explanation
                      onExplain={() => handleExplain(answer.questionId)}
                      isExplaining={explanations[answer.questionId]?.loading}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exam Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Total Marks</span>
                  <span className="font-medium">{exam.settings.totalMarks}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="font-medium">{exam.settings.duration} mins</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Passing Marks</span>
                  <span className="font-medium">{exam.settings.passingMarks || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Time Taken</span>
                  <span className="font-medium">{Math.round(result.timing.totalTimeSpent / 60)} mins</span>
                </div>
              </CardContent>
            </Card>

            {result.feedback && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-green-600 mb-2">Strengths</h4>
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {result.feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-600 mb-2">Improvements</h4>
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {result.feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResultDetailsPage

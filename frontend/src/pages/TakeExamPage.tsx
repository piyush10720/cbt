import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from 'react-query'
import { examAPI, resultAPI, bookmarkAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatTime } from '@/lib/utils'
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Send, Calculator, BookOpen, Tag, ChevronDown, ChevronUp, Bookmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOptionLabel, getOptionText, hasOptionDiagram, getOptionDiagramUrl } from '@/utils/questionHelpers'
import ImageModal from '@/components/ImageModal'
import ScientificCalculator from '@/components/ScientificCalculator'
import MathText from '@/components/MathText'
import SEO from '@/components/SEO'

type StartExamResponse = {
  message: string
  data: {
    resultId: string
    exam: {
      id: string
      title: string
      description?: string
      settings: {
        duration: number
        totalMarks: number
        negativeMarking: boolean
        randomizeQuestions: boolean
        randomizeOptions: boolean
        showResultImmediately: boolean
        allowReview: boolean
        preventTabSwitch: boolean
        webcamMonitoring: boolean
        maxAttempts: number
        allowCalculator: boolean
        allowPracticeMode: boolean
      }
      questions: Array<{
        _id?: string
        id?: string
        type: string
        text: string
        options?: any[]
        marks: number
        order?: number
        tags?: string[]
        diagram?: {
          present: boolean
          url?: string
          description?: string
        }
        correct?: any // For practice mode
      }>
    }
    attempt: {
      number: number
      startedAt: string
      timeRemaining?: number
      answers?: Array<{
        questionId: string
        userAnswer: any
        isMarkedForReview?: boolean
      }>
    }
  }
}

type SubmitAnswerPayload = {
  questionId: string
  userAnswer: any
  isMarkedForReview?: boolean
}

const FULLSCREEN_CHANGE_EVENTS: string[] = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']

const TakeExamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const hasSubmittedRef = useRef(false)
  const hasBlurredRef = useRef(false)
  const fullscreenRequestedRef = useRef(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null)

  const [showCalculator, setShowCalculator] = useState(false)
  const [searchParams] = useSearchParams()
  const isPracticeMode = searchParams.get('mode') === 'practice'
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, { 
    isCorrect: boolean; 
    explanation?: {
      overview: string;
      why_user_answer: string;
      why_correct_answer: string;
      tips: string[];
    }; 
    correctAnswer?: any 
  }>>({})
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({})
  const [loadingExplanation, setLoadingExplanation] = useState<Record<string, boolean>>({})
  const [showTagsExpanded, setShowTagsExpanded] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set())
  const [loadingBookmark, setLoadingBookmark] = useState<Record<string, boolean>>({})

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<StartExamResponse>(
    ['start-exam', id],
    async () => {
      if (!id) {
        throw new Error('Missing exam identifier')
      }
      const response = await examAPI.startExam(id, isPracticeMode ? 'practice' : 'exam')
      const data = response.data as any
      return {
        message: data.message || 'Exam started',
        data: {
          ...data.data,
          exam: {
            ...data.data.exam,
            settings: {
              ...data.data.exam.settings,
              allowCalculator: data.data.exam.settings.allowCalculator ?? false,
              allowPracticeMode: data.data.exam.settings.allowPracticeMode ?? false
            }
          }
        }
      } as StartExamResponse
    },
    {
      enabled: !!id,
      retry: false,
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to start exam'
        toast.error(message)
      }
    }
  )

  const resultId = data?.data.resultId
  const exam = data?.data.exam
  const attempt = data?.data.attempt

  const questions = useMemo(() => {
    if (!exam) return []
    return exam.questions
  }, [exam])

  useEffect(() => {
    if (!questions.length) return

    setAnswers((prev) => {
      if (attempt?.answers && attempt.answers.length > 0) {
        const restoredAnswers: Record<string, any> = {}
        attempt.answers.forEach((ans: any) => {
           if (ans.questionId) {
             restoredAnswers[ans.questionId] = ans.userAnswer
           }
        })
        questions.forEach((question) => {
          const questionId = question._id || question.id || ''
          if (questionId && restoredAnswers[questionId] === undefined) {
            restoredAnswers[questionId] = null
          }
        })
        return restoredAnswers
      }

      if (Object.keys(prev).length > 0) {
        return prev
      }
      const initial: Record<string, any> = {}
      questions.forEach((question) => {
        const questionId = question._id || question.id || ''
        if (questionId) {
          initial[questionId] = null
        }
      })
      return initial
    })

    setMarkedForReview((prev) => {
      if (attempt?.answers && attempt.answers.length > 0) {
        const restoredMarked: Record<string, boolean> = {}
        attempt.answers.forEach((ans: any) => {
           if (ans.questionId) {
             restoredMarked[ans.questionId] = ans.isMarkedForReview || false
           }
        })
        questions.forEach((question) => {
          const questionId = question._id || question.id || ''
          if (questionId && restoredMarked[questionId] === undefined) {
            restoredMarked[questionId] = false
          }
        })
        return restoredMarked
      }

      if (Object.keys(prev).length > 0) {
        return prev
      }
      const initial: Record<string, boolean> = {}
      questions.forEach((question) => {
        const questionId = question._id || question.id || ''
        if (questionId) {
          initial[questionId] = false
        }
      })
      return initial
    })
  }, [questions, attempt])

  useEffect(() => {
    if (!resultId) return

    const fetchBookmarks = async () => {
      try {
        const response = await bookmarkAPI.checkBookmarks(resultId)
        setBookmarkedQuestions(new Set(response.data.bookmarkedQuestions))
      } catch (error) {
        console.error('Failed to fetch bookmarks', error)
      }
    }

    fetchBookmarks()
  }, [resultId])

  useEffect(() => {
    if (!exam) return
    if (timeLeft !== null) return

    const startingTime = attempt?.timeRemaining ?? exam.settings.duration * 60
    setTimeLeft(startingTime)

    if (exam.settings.preventTabSwitch && !isPracticeMode) {
      const requestFullscreen = async () => {
        try {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            fullscreenRequestedRef.current = true
            await document.documentElement.requestFullscreen()
            toast.success('Fullscreen mode enabled for secure exam environment.')
          }
        } catch (err: any) {
          setFullscreenError('Fullscreen permission denied. Exam will proceed but may auto submit on focus change.')
          toast.error(fullscreenError)
        }
      }
      requestFullscreen()
    }
  }, [exam, attempt, timeLeft, isPracticeMode])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return prev
        return prev > 0 ? prev - 1 : 0
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLeft])

  const submitAnswerMutation = useMutation(
    async ({ questionId, userAnswer, isMarkedForReview }: SubmitAnswerPayload) => {
      if (!resultId) {
        throw new Error('Missing result identifier')
      }
      return resultAPI.submitAnswer(resultId, {
        questionId,
        userAnswer,
        isMarkedForReview
      })
    },
    {
      onError: () => {
        toast.error('Failed to save answer')
      }
    }
  )

  const submitExamMutation = useMutation(
    async ({ isAutoSubmit }: { isAutoSubmit: boolean }) => {
      if (!resultId) {
        throw new Error('Missing result identifier')
      }
      return resultAPI.submitExam(resultId, isAutoSubmit)
    },
    {
      onSuccess: (response, variables) => {
        const result = response.data.result
        toast.success(variables.isAutoSubmit ? 'Time is up. Exam submitted.' : 'Exam submitted successfully!')
        hasSubmittedRef.current = true
        navigate(`/results/${result.id}`)
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to submit exam'
        toast.error(message)
      }
    }
  )

  useEffect(() => {
    if (!exam?.settings.preventTabSwitch || hasSubmittedRef.current || isPracticeMode) {
      return
    }

    const autoSubmit = (reason: string) => {
      if (!hasSubmittedRef.current) {
        toast.error(reason)
        submitExamMutation.mutate({ isAutoSubmit: true })
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden && !hasBlurredRef.current) {
        hasBlurredRef.current = true
        autoSubmit('Focus lost or tab switch detected. Submitting exam.')
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenRequestedRef.current) {
        autoSubmit('Fullscreen exited. Submitting exam.')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    FULLSCREEN_CHANGE_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleFullscreenChange)
    })

    window.addEventListener('beforeunload', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      FULLSCREEN_CHANGE_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, handleFullscreenChange)
      })
      window.removeEventListener('beforeunload', handleVisibilityChange)
    }
  }, [exam?.settings.preventTabSwitch, submitExamMutation, isPracticeMode])

  useEffect(() => {
    if (timeLeft === 0 && !hasSubmittedRef.current) {
      submitExamMutation.mutate({ isAutoSubmit: true })
    }
  }, [timeLeft, submitExamMutation])

  useEffect(() => {
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const currentQuestion = questions[currentIndex]
  const currentQuestionId = currentQuestion ? currentQuestion._id || currentQuestion.id || '' : ''

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }))

    if (!isPracticeMode) {
      submitAnswerMutation.mutate({
        questionId,
        userAnswer: value,
        isMarkedForReview: markedForReview[questionId]
      })
    }
  }

  const handleToggleReview = (questionId: string) => {
    setMarkedForReview((prev) => {
      const updated = {
        ...prev,
        [questionId]: !prev[questionId]
      }
      submitAnswerMutation.mutate({
        questionId,
        userAnswer: answers[questionId],
        isMarkedForReview: updated[questionId]
      })
      return updated
    })
  }

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return
    setCurrentIndex(index)
  }

  const handleSubmitExam = () => {
    if (!resultId || hasSubmittedRef.current) return

    const unanswered = questions.filter((question) => {
      const questionId = question._id || question.id || ''
      return questionId && (answers[questionId] === null || answers[questionId] === undefined)
    }).length

    const shouldSubmit = window.confirm(
      unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Are you sure you want to submit?`
        : 'Submit exam now?'
    )

    if (!shouldSubmit) return

    submitExamMutation.mutate({ isAutoSubmit: false })
  }

  const handleCheckAnswer = async () => {
    if (!currentQuestionId || !resultId) return

    const userAnswer = answers[currentQuestionId]
    if (userAnswer === null || userAnswer === undefined) {
      toast.error('Please select an answer first')
      return
    }

    if (currentQuestion.correct && isPracticeMode) {
      let isCorrect = false
      const correctAnswers = currentQuestion.correct

      if (currentQuestion.type === 'mcq_single' || currentQuestion.type === 'true_false') {
        isCorrect = correctAnswers.includes(userAnswer)
      } else if (currentQuestion.type === 'mcq_multi') {
        if (Array.isArray(userAnswer) && userAnswer.length === correctAnswers.length) {
          const sortedSelected = [...userAnswer].sort()
          const sortedCorrect = [...correctAnswers].sort()
          isCorrect = sortedSelected.every((val, index) => val === sortedCorrect[index])
        }
      } else if (currentQuestion.type === 'numeric') {
        isCorrect = correctAnswers.includes(String(userAnswer))
      }
      
      setPracticeAnswers(prev => ({
        ...prev,
        [currentQuestionId]: {
          isCorrect,
          correctAnswer: correctAnswers,
          userAnswer: userAnswer,
          explanation: undefined
        }
      }))

      if (isCorrect) {
        toast.success('Correct Answer!', { duration: 2000 })
      } else {
        toast.error('Incorrect Answer', { duration: 2000 })
      }
      
      setShowExplanation(prev => ({
        ...prev,
        [currentQuestionId]: false
      }))

      resultAPI.submitAnswer(resultId, {
        questionId: currentQuestionId,
        userAnswer: userAnswer,
        timeSpent: 0,
        isMarkedForReview: markedForReview[currentQuestionId]
      }).catch(err => console.error('Background save failed', err))

      return
    }

    try {
      const response = await resultAPI.submitAnswer(resultId, {
        questionId: currentQuestionId,
        userAnswer,
        isMarkedForReview: markedForReview[currentQuestionId]
      })

      const isCorrect = response.data.data.isCorrect
      const correctAnswer = response.data.data.correctAnswer
      
      setPracticeAnswers(prev => ({
        ...prev,
        [currentQuestionId]: {
          isCorrect,
          correctAnswer,
          explanation: undefined
        }
      }))
      
      setShowExplanation(prev => ({
        ...prev,
        [currentQuestionId]: false
      }))

    } catch (error) {
      toast.error('Failed to check answer')
    }
  }

  const handleExplainAnswer = async () => {
    if (!currentQuestionId || !resultId) return

    if (practiceAnswers[currentQuestionId]?.explanation) {
      setShowExplanation(prev => ({
        ...prev,
        [currentQuestionId]: !prev[currentQuestionId]
      }))
      return
    }

    setLoadingExplanation(prev => ({ ...prev, [currentQuestionId]: true }))

    try {
      const response = await resultAPI.explainAnswer(resultId, currentQuestionId)
      
      if (response.data.success) {
        const explanationData = response.data.explanation
        setPracticeAnswers(prev => ({
          ...prev,
          [currentQuestionId]: {
            ...prev[currentQuestionId],
            explanation: explanationData
          }
        }))
        
        setShowExplanation(prev => ({
          ...prev,
          [currentQuestionId]: true
        }))
      }
    } catch (error) {
      toast.error('Failed to get explanation')
    } finally {
      setLoadingExplanation(prev => ({ ...prev, [currentQuestionId]: false }))
    }
  }

  const handleToggleBookmark = async () => {
    if (!currentQuestionId || !resultId) return

    setLoadingBookmark(prev => ({ ...prev, [currentQuestionId]: true }))
    try {
      const response = await bookmarkAPI.toggleBookmark({
        questionId: currentQuestionId,
        resultId
      })
      
      setBookmarkedQuestions(prev => {
        const newSet = new Set(prev)
        if (response.data.bookmarked) {
          newSet.add(currentQuestionId)
          toast.success('Question bookmarked')
        } else {
          newSet.delete(currentQuestionId)
          toast.success('Bookmark removed')
        }
        return newSet
      })
    } catch (error) {
      toast.error('Failed to update bookmark')
    } finally {
      setLoadingBookmark(prev => ({ ...prev, [currentQuestionId]: false }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !exam) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h1 className="text-2xl font-bold">Failed to load exam</h1>
        <p className="text-muted-foreground">{(error as any)?.message || 'An error occurred'}</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <SEO title={`Taking Exam: ${exam.title}`} />
      
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            {exam.description && <p className="text-muted-foreground">{exam.description}</p>}
          </div>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 rounded-lg border px-4 py-2 ${
              timeLeft !== null && timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-card'
            }`}>
              <Clock className="h-5 w-5" />
              <span className="font-mono text-xl font-bold">
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </span>
            </div>
            {exam.settings.allowCalculator && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCalculator(!showCalculator)}
                className={showCalculator ? 'bg-primary/10' : ''}
              >
                <Calculator className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <Card className="min-h-[400px]">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      Question {currentIndex + 1} of {questions.length}
                    </CardTitle>
                    {currentQuestion.tags && currentQuestion.tags.length > 0 && (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setShowTagsExpanded(!showTagsExpanded)}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {currentQuestion.tags.length} tags
                          {showTagsExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                        </Button>
                        {showTagsExpanded && (
                          <div className="absolute top-full left-0 mt-1 z-10 bg-popover border rounded-md shadow-md p-2 min-w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {currentQuestion.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <CardDescription>
                    Marks: {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
                    {exam.settings.negativeMarking && ' (Negative marking applied)'}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleBookmark}
                  disabled={loadingBookmark[currentQuestionId]}
                  className={bookmarkedQuestions.has(currentQuestionId) ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-foreground'}
                >
                  {loadingBookmark[currentQuestionId] ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Bookmark className={`h-5 w-5 ${bookmarkedQuestions.has(currentQuestionId) ? 'fill-current' : ''}`} />
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose dark:prose-invert max-w-none">
                  <MathText text={currentQuestion.text} />
                </div>

                {currentQuestion.diagram?.present && currentQuestion.diagram.url && (
                  <div className="my-4">
                    <img 
                      src={currentQuestion.diagram.url} 
                      alt="Question Diagram" 
                      className="max-w-full h-auto max-h-96 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setModalImage({ 
                        src: currentQuestion.diagram!.url!, 
                        alt: 'Question Diagram' 
                      })}
                    />
                    {currentQuestion.diagram.description && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        {currentQuestion.diagram.description}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {(() => {
                    const answerValue = answers[currentQuestionId]

                    switch (currentQuestion.type) {
                      case 'mcq_single':
                      case 'true_false':
                        return (
                          <div className="space-y-3">
                            {(currentQuestion.options || ['True', 'False']).map((option, idx) => {
                              const optionLabel = getOptionLabel(option)
                              const optionText = getOptionText(option)
                              const hasDiagram = hasOptionDiagram(option)
                              const diagramUrl = getOptionDiagramUrl(option)
                              
                              return (
                                <label
                                  key={optionLabel || idx}
                                  className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                    answerValue === optionLabel 
                                      ? isPracticeMode && practiceAnswers[currentQuestionId]
                                        ? practiceAnswers[currentQuestionId].isCorrect 
                                          ? 'border-green-500 bg-green-500/10'
                                          : 'border-red-500 bg-red-500/10'
                                        : 'border-blue-500 bg-blue-500/10' 
                                      : isPracticeMode && practiceAnswers[currentQuestionId] && !practiceAnswers[currentQuestionId].isCorrect && practiceAnswers[currentQuestionId].correctAnswer?.includes(optionLabel)
                                        ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/20'
                                        : 'border-border hover:border-blue-500/50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={currentQuestionId}
                                    value={optionLabel}
                                    checked={answerValue === optionLabel}
                                    onChange={() => handleAnswerChange(currentQuestionId, optionLabel)}
                                    className="h-4 w-4 mt-1"
                                  />
                                  <div className="flex-1">
                                    <MathText text={optionText} className="text-sm text-foreground" />
                                    {hasDiagram && diagramUrl && (
                                      <img 
                                        src={diagramUrl} 
                                        alt={`Option ${optionLabel}`}
                                        className="mt-2 max-w-full h-auto max-h-48 rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setModalImage({ src: diagramUrl, alt: `Option ${optionLabel} - Diagram` })
                                        }}
                                      />
                                    )}
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        )

                      case 'mcq_multi':
                        return (
                          <div className="space-y-3">
                            {(currentQuestion.options || []).map((option, idx) => {
                              const optionLabel = getOptionLabel(option)
                              const optionText = getOptionText(option)
                              const hasDiagram = hasOptionDiagram(option)
                              const diagramUrl = getOptionDiagramUrl(option)
                              const selectedOptions: string[] = Array.isArray(answerValue) ? answerValue : []
                              const isSelected = selectedOptions.includes(optionLabel)
                              const toggleOption = () => {
                                const updated = isSelected
                                  ? selectedOptions.filter((item) => item !== optionLabel)
                                  : [...selectedOptions, optionLabel]
                                handleAnswerChange(currentQuestionId, updated)
                              }

                              return (
                                <label
                                  key={optionLabel || idx}
                                  className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                    isSelected 
                                      ? isPracticeMode && practiceAnswers[currentQuestionId]
                                        ? practiceAnswers[currentQuestionId].isCorrect
                                          ? 'border-green-500 bg-green-500/10'
                                          : 'border-red-500 bg-red-500/10'
                                        : 'border-blue-500 bg-blue-500/10'
                                      : isPracticeMode && practiceAnswers[currentQuestionId] && !practiceAnswers[currentQuestionId].isCorrect && practiceAnswers[currentQuestionId].correctAnswer?.includes(optionLabel)
                                        ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/20'
                                        : 'border-border hover:border-blue-500/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    value={optionLabel}
                                    checked={isSelected}
                                    onChange={toggleOption}
                                    className="h-4 w-4 mt-1"
                                  />
                                  <div className="flex-1">
                                    <MathText text={optionText} className="text-sm text-foreground" />
                                    {hasDiagram && diagramUrl && (
                                      <img 
                                        src={diagramUrl} 
                                        alt={`Option ${optionLabel}`}
                                        className="mt-2 max-w-full h-auto max-h-48 rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setModalImage({ src: diagramUrl, alt: `Option ${optionLabel} - Diagram` })
                                        }}
                                      />
                                    )}
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        )
                      
                      default:
                        return <p>Unsupported question type</p>
                    }
                  })()}
                </div>

                {/* Explanation Section */}
                {isPracticeMode && showExplanation[currentQuestionId] && practiceAnswers[currentQuestionId]?.explanation && (
                  <div className="mt-6 border-t pt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-lg">Explanation</h3>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-1">Overview</h4>
                        <div className="text-sm text-foreground">
                          <MathText text={practiceAnswers[currentQuestionId].explanation!.overview} block />
                        </div>
                      </div>

                      <div>
                        <h4 className={`font-medium text-sm uppercase tracking-wider mb-1 ${practiceAnswers[currentQuestionId].isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          Why your answer is {practiceAnswers[currentQuestionId].isCorrect ? 'correct' : 'incorrect'}
                        </h4>
                        <div className="text-sm text-foreground">
                          <MathText 
                            text={practiceAnswers[currentQuestionId].isCorrect 
                              ? practiceAnswers[currentQuestionId].explanation!.why_correct_answer 
                              : practiceAnswers[currentQuestionId].explanation!.why_user_answer} 
                            block 
                          />
                        </div>
                      </div>

                      {!practiceAnswers[currentQuestionId].isCorrect && (
                        <div>
                          <h4 className="font-medium text-sm text-green-600 uppercase tracking-wider mb-1">Correct Answer Logic</h4>
                          <div className="text-sm text-foreground">
                            <MathText text={practiceAnswers[currentQuestionId].explanation!.why_correct_answer} block />
                          </div>
                        </div>
                      )}

                      {practiceAnswers[currentQuestionId].explanation!.tips.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-md">
                          <h4 className="font-medium text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Tips</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {practiceAnswers[currentQuestionId].explanation!.tips.map((tip, idx) => (
                              <li key={idx} className="text-sm text-foreground">
                                <MathText text={tip} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-2">
                {!isPracticeMode && (
                  <Button
                    variant="outline"
                    onClick={() => handleToggleReview(currentQuestionId)}
                    disabled={!currentQuestionId}
                    className={markedForReview[currentQuestionId] ? 'border-yellow-400 text-yellow-600 dark:text-yellow-400' : ''}
                  >
                    <Flag className="mr-2 h-4 w-4" />
                    {markedForReview[currentQuestionId] ? 'Unmark Review' : 'Mark for Review'}
                  </Button>
                )}
                
                {isPracticeMode && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCheckAnswer}
                      disabled={!currentQuestionId || answers[currentQuestionId] === null || answers[currentQuestionId] === undefined}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Check Answer
                    </Button>
                    {practiceAnswers[currentQuestionId] && (
                      <Button
                        variant="outline"
                        onClick={handleExplainAnswer}
                        disabled={loadingExplanation[currentQuestionId]}
                      >
                        {loadingExplanation[currentQuestionId] ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <BookOpen className="mr-2 h-4 w-4" />
                            {showExplanation[currentQuestionId] ? 'Hide Explanation' : 'Explain Answer'}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {submitAnswerMutation.isLoading && <span className="text-xs text-muted-foreground">Saving…</span>}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => goToQuestion(currentIndex + 1)}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleSubmitExam}
                  disabled={submitExamMutation.isLoading || hasSubmittedRef.current}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit Exam
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Question Navigator</CardTitle>
                <CardDescription>Select a question to jump to it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((question, index) => {
                    const questionId = question._id || question.id || ''
                    const answered = answers[questionId] !== null && answers[questionId] !== undefined &&
                      ((Array.isArray(answers[questionId]) && answers[questionId].length > 0) ||
                        (!Array.isArray(answers[questionId]) && answers[questionId] !== '' && answers[questionId] !== null))
                    const isMarked = markedForReview[questionId]
                    const isActive = index === currentIndex

                    return (
                      <button
                        key={questionId || index}
                        onClick={() => goToQuestion(index)}
                        className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isActive
                            ? 'border-blue-600 bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            : answered
                            ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300'
                            : 'border-border text-muted-foreground hover:border-blue-500/50'
                        } ${isMarked ? 'ring-2 ring-yellow-500 ring-offset-1' : ''}`}
                      >
                        {answered ? <CheckCircle className="h-4 w-4" /> : index + 1}
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-green-500/20 text-green-700 dark:text-green-300 text-[10px] font-semibold">✓</span>
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="h-4 w-4 rounded border border-muted-foreground" />
                    <span>Not answered</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="h-4 w-4 rounded border border-yellow-500 ring-2 ring-yellow-500" />
                    <span>Marked for review</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exam Settings</CardTitle>
                <CardDescription>Quick reference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Total Marks: {exam.settings.totalMarks}</p>
                <p>Negative Marking: {exam.settings.negativeMarking ? 'Yes' : 'No'}</p>
                <p>Allow Review: {exam.settings.allowReview ? 'Yes' : 'No'}</p>
                <p>Randomize Questions: {exam.settings.randomizeQuestions ? 'Enabled' : 'Disabled'}</p>
                <p>Calculator: {exam.settings.allowCalculator ? 'Allowed' : 'Not Allowed'}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <ImageModal 
          src={modalImage?.src || ''} 
          alt={modalImage?.alt || ''} 
          isOpen={!!modalImage} 
          onClose={() => setModalImage(null)} 
        />

        {/* Scientific Calculator */}
        {exam.settings.allowCalculator && showCalculator && (
          <ScientificCalculator onClose={() => setShowCalculator(false)} />
        )}
      </div>
    </div>
  )
}

export default TakeExamPage

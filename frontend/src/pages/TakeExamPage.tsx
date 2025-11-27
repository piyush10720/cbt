import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from 'react-query'
import { examAPI, resultAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatTime } from '@/lib/utils'
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Send, Calculator, BookOpen, CheckCircle2, Tag, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOptionLabel, getOptionText, hasOptionDiagram, getOptionDiagramUrl } from '@/utils/questionHelpers'
import ImageModal from '@/components/ImageModal'
import ScientificCalculator from '@/components/ScientificCalculator'
import MathText from '@/components/MathText'

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
  const { } = useAuth() // Auth context available if needed
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

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<StartExamResponse>(
    ['start-exam', id],
    async () => {
      if (!id) {
        throw new Error('Missing exam identifier')
      }
      const response = await examAPI.startExam(id)
      // Ensure the response matches StartExamResponse type
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
      // If we have answers from the resumed attempt, use them
      if (attempt?.answers && attempt.answers.length > 0) {
        const restoredAnswers: Record<string, any> = {}
        attempt.answers.forEach((ans: any) => {
           if (ans.questionId) {
             restoredAnswers[ans.questionId] = ans.userAnswer
           }
        })
        // Merge with existing state to avoid overwriting if user has already interacted (though on mount it should be empty)
        // But we also need to initialize nulls for unanswered questions
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
      // If we have answers from the resumed attempt, restore marked for review status
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
        }
      }
      requestFullscreen()
    }
  }, [exam, attempt, timeLeft])

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
  }, [exam?.settings.preventTabSwitch, submitExamMutation])

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
          explanation: undefined // Reset explanation when checking new answer
        }
      }))
      
      // Reset explanation visibility
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

    // If we already have the explanation, just toggle visibility
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
        // Format explanation for display
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

  const renderQuestionContent = () => {
    if (!currentQuestion || !currentQuestionId) {
      return <p className="text-muted-foreground">No question selected.</p>
    }

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

      case 'numeric':
        return (
          <input
            type="number"
            className="w-full rounded-md border border-input p-2 focus:border-primary focus:outline-none bg-background"
            value={answerValue ?? ''}
            onChange={(event) => handleAnswerChange(currentQuestionId, event.target.value)}
            placeholder="Enter numeric answer"
          />
        )

      case 'descriptive':
        return (
          <textarea
            className="w-full min-h-[160px] rounded-md border border-input p-3 focus:border-primary focus:outline-none bg-background"
            value={answerValue ?? ''}
            onChange={(event) => handleAnswerChange(currentQuestionId, event.target.value)}
            placeholder="Write your answer here"
          />
        )

      default:
        return <p className="text-muted-foreground">Unsupported question type.</p>
    }
  }

  if (isLoading || !exam || !attempt || !questions.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isLoading ? (
          <div className="flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold text-foreground">Unable to start exam</h2>
              <p className="text-muted-foreground">{(error as any)?.response?.data?.message || 'Please try again or contact support.'}</p>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <LoadingSpinner size="lg" />
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {fullscreenError && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded">
          {fullscreenError}
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">Attempt #{attempt.number} · Total Questions: {questions.length}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {exam.settings.allowCalculator && (
            <Button
              onClick={() => setShowCalculator(!showCalculator)}
              variant="outline"
              className="flex items-center space-x-2 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/50"
            >
              <Calculator className="h-4 w-4" />
              <span>{showCalculator ? 'Hide' : 'Show'} Calculator</span>
            </Button>
          )}
          <Card className="w-full lg:w-auto">
            <CardContent className="flex items-center space-x-3 py-3 px-4">
              <Clock className={`h-5 w-5 ${timeLeft !== null && timeLeft < 300 ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'}`} />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Time Remaining</p>
                <p className="text-lg font-semibold text-foreground">{timeLeft !== null ? formatTime(timeLeft) : 'Calculating…'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/50 px-6 py-3 border-b flex flex-row justify-between items-center space-y-0">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-lg">Question {currentIndex + 1}</CardTitle>
                <Badge variant="secondary">
                  {currentQuestion?.marks ?? 0} Marks
                </Badge>
                {currentQuestion?.tags && currentQuestion.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {!showTagsExpanded ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowTagsExpanded(true)}
                      >
                        <Tag className="w-3 h-3 mr-1" /> Show Tags <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        {currentQuestion.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px] h-5 px-1.5">
                            {tag}
                          </Badge>
                        ))}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 ml-1"
                          onClick={() => setShowTagsExpanded(false)}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-foreground leading-relaxed">
                <MathText text={currentQuestion?.text || ''} block />
              </div>
              {currentQuestion?.diagram?.present && currentQuestion?.diagram?.url && (
                <div className="my-4">
                  <img 
                    src={currentQuestion.diagram.url} 
                    alt="Question diagram"
                    className="max-w-full h-auto max-h-64 rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setModalImage({  
                      src: currentQuestion.diagram!.url!, 
                      alt: currentQuestion.diagram?.description || 'Question diagram' 
                    })}
                  />
                  {currentQuestion.diagram.description && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      {currentQuestion.diagram.description} <span className="text-blue-600 dark:text-blue-400">(Click to enlarge)</span>
                    </p>
                  )}
                </div>
              )}
              {renderQuestionContent()}

              {isPracticeMode && practiceAnswers[currentQuestionId] && (
                <div className={`mt-6 p-4 rounded-lg border ${practiceAnswers[currentQuestionId].isCorrect ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {practiceAnswers[currentQuestionId].isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className={`font-medium ${practiceAnswers[currentQuestionId].isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {practiceAnswers[currentQuestionId].isCorrect ? 'Correct Answer' : 'Incorrect Answer'}
                    </span>
                  </div>

                  {!practiceAnswers[currentQuestionId].isCorrect && practiceAnswers[currentQuestionId].correctAnswer && (
                     <div className="mb-4 text-sm">
                        <span className="font-semibold text-foreground">Correct Answer: </span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {Array.isArray(practiceAnswers[currentQuestionId].correctAnswer) 
                            ? practiceAnswers[currentQuestionId].correctAnswer.join(', ') 
                            : practiceAnswers[currentQuestionId].correctAnswer}
                        </span>
                     </div>
                  )}
                  
                  {showExplanation[currentQuestionId] && practiceAnswers[currentQuestionId].explanation && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-lg font-semibold">Explanation</h3>
                      </div>

                      <div className="space-y-4">
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
  )
}

export default TakeExamPage

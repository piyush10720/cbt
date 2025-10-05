import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from 'react-query'
import { examAPI, resultAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatTime } from '@/lib/utils'
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Send } from 'lucide-react'
import toast from 'react-hot-toast'

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
      }
      questions: Array<{
        _id?: string
        id?: string
        type: string
        text: string
        options?: string[]
        marks: number
        order?: number
      }>
    }
    attempt: {
      number: number
      startedAt: string
      timeRemaining?: number
    }
  }
}

type SubmitAnswerPayload = {
  questionId: string
  userAnswer: any
  isMarkedForReview?: boolean
}

const ENTER_FULLSCREEN_MESSAGE = 'Exam requires fullscreen. Switching tabs or exiting fullscreen will submit your attempt.'
const FULLSCREEN_CHANGE_EVENTS: string[] = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']

const TakeExamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const hasSubmittedRef = useRef(false)
  const hasBlurredRef = useRef(false)
  const fullscreenRequestedRef = useRef(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)

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
      return response.data as StartExamResponse
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
  }, [questions])

  useEffect(() => {
    if (!exam) return
    if (timeLeft !== null) return

    const startingTime = attempt?.timeRemaining ?? exam.settings.duration * 60
    setTimeLeft(startingTime)

    if (exam.settings.preventTabSwitch) {
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
    if (!exam?.settings.preventTabSwitch || hasSubmittedRef.current) {
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

    submitAnswerMutation.mutate({
      questionId,
      userAnswer: value,
      isMarkedForReview: markedForReview[questionId]
    })
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

  const renderQuestionContent = () => {
    if (!currentQuestion || !currentQuestionId) {
      return <p className="text-gray-500">No question selected.</p>
    }

    const answerValue = answers[currentQuestionId]

    switch (currentQuestion.type) {
      case 'mcq_single':
      case 'true_false':
        return (
          <div className="space-y-3">
            {(currentQuestion.options || ['True', 'False']).map((option) => (
              <label
                key={option}
                className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  answerValue === option ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name={currentQuestionId}
                  value={option}
                  checked={answerValue === option}
                  onChange={() => handleAnswerChange(currentQuestionId, option)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        )

      case 'mcq_multi':
        return (
          <div className="space-y-3">
            {(currentQuestion.options || []).map((option) => {
              const selectedOptions: string[] = Array.isArray(answerValue) ? answerValue : []
              const isSelected = selectedOptions.includes(option)
              const toggleOption = () => {
                const updated = isSelected
                  ? selectedOptions.filter((item) => item !== option)
                  : [...selectedOptions, option]
                handleAnswerChange(currentQuestionId, updated)
              }

              return (
                <label
                  key={option}
                  className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={option}
                    checked={isSelected}
                    onChange={toggleOption}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              )
            })}
          </div>
        )

      case 'numeric':
        return (
          <input
            type="number"
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            value={answerValue ?? ''}
            onChange={(event) => handleAnswerChange(currentQuestionId, event.target.value)}
            placeholder="Enter numeric answer"
          />
        )

      case 'descriptive':
        return (
          <textarea
            className="w-full min-h-[160px] rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
            value={answerValue ?? ''}
            onChange={(event) => handleAnswerChange(currentQuestionId, event.target.value)}
            placeholder="Write your answer here"
          />
        )

      default:
        return <p className="text-gray-500">Unsupported question type.</p>
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
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-800">Unable to start exam</h2>
              <p className="text-gray-500">{(error as any)?.response?.data?.message || 'Please try again or contact support.'}</p>
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
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded">
          {fullscreenError}
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
          <p className="text-sm text-gray-500">Attempt #{attempt.number} · Total Questions: {questions.length}</p>
        </div>
        <Card className="w-full lg:w-auto">
          <CardContent className="flex items-center space-x-3 py-3 px-4">
            <Clock className={`h-5 w-5 ${timeLeft !== null && timeLeft < 300 ? 'text-red-500' : 'text-blue-600'}`} />
            <div>
              <p className="text-xs uppercase text-gray-500">Time Remaining</p>
              <p className="text-lg font-semibold text-gray-900">{timeLeft !== null ? formatTime(timeLeft) : 'Calculating…'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Question {currentIndex + 1}</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Marks: {currentQuestion?.marks ?? 0}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-gray-800 leading-relaxed whitespace-pre-line">{currentQuestion?.text}</div>
              {renderQuestionContent()}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => handleToggleReview(currentQuestionId)}
                disabled={!currentQuestionId}
                className={markedForReview[currentQuestionId] ? 'border-yellow-400 text-yellow-600' : ''}
              >
                <Flag className="mr-2 h-4 w-4" />
                {markedForReview[currentQuestionId] ? 'Unmark Review' : 'Mark for Review'}
              </Button>
              {submitAnswerMutation.isLoading && <span className="text-xs text-gray-500">Saving…</span>}
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
                          ? 'border-blue-600 bg-blue-100 text-blue-700'
                          : answered
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 text-gray-600 hover:border-blue-300'
                      } ${isMarked ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}
                    >
                      {answered ? <CheckCircle className="h-4 w-4" /> : index + 1}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center space-x-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-green-200 text-green-700 text-[10px] font-semibold">✓</span>
                  <span>Answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="h-4 w-4 rounded border border-gray-400" />
                  <span>Not answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="h-4 w-4 rounded border border-yellow-400 ring-2 ring-yellow-400" />
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
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>Total Marks: {exam.settings.totalMarks}</p>
              <p>Negative Marking: {exam.settings.negativeMarking ? 'Yes' : 'No'}</p>
              <p>Allow Review: {exam.settings.allowReview ? 'Yes' : 'No'}</p>
              <p>Randomize Questions: {exam.settings.randomizeQuestions ? 'Enabled' : 'Disabled'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default TakeExamPage

import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { examAPI, resultAPI, Explanation } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LoadingSpinner from '@/components/LoadingSpinner'
import ExamAnalytics from '@/components/ExamAnalytics'
import { calculatePercentage, formatDate, getGradeFromPercentage, getPerformanceColor } from '@/lib/utils'
import { AlertCircle, AlertTriangle, ArrowLeft, Award, BarChart3, CheckCircle2, CircleSlash, Clock, Flag, Lightbulb, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOptionLabel, getOptionText, hasOptionDiagram, getOptionDiagramUrl } from '@/utils/questionHelpers'
import ImageModal from '@/components/ImageModal'
import MathText from '@/components/MathText'

type ExamDetailsResponse = {
  exam: {
    id: string
    title: string
    description?: string
    createdBy: {
      _id: string
      name: string
      email: string
    }
    questionCount: number
    questions?: Array<{
      _id: string
      id?: string
      type: string
      text: string
      options?: any[]
      marks: number
      order?: number
      diagram?: {
        present: boolean
        url?: string
        description?: string
      }
    }>
    settings: {
      duration: number
      totalMarks: number
      passingMarks?: number
      negativeMarking: boolean
      randomizeQuestions: boolean
      randomizeOptions: boolean
      showResultImmediately: boolean
      allowReview: boolean
      preventTabSwitch: boolean
      webcamMonitoring: boolean
      maxAttempts: number
    }
    schedule: {
      startDate: string
      endDate: string
      timezone: string
    }
    access: {
      type: 'public' | 'private' | 'restricted'
      allowedUsers?: string[]
      accessCode?: string
      requireApproval: boolean
    }
    status: 'draft' | 'published' | 'active' | 'completed' | 'archived'
    isPublished: boolean
    isActive: boolean
    createdAt: string
    statistics?: {
      totalAttempts: number
      averageScore: number
      highestScore: number
      lowestScore: number
      completionRate: number
      scoreDistribution: Array<{
        label: string
        count: number
      }>
    }
  }
}

const ExamDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isTeacher, isAdmin } = useAuth()
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ExamDetailsResponse>(
    ['exam-details', id],
    async () => {
      if (!id) {
        throw new Error('Missing exam id')
      }
      const response = await examAPI.getExamById(id, true)
      return response.data as ExamDetailsResponse
    },
    {
      enabled: !!id
    }
  )

  const exam = data?.exam
  const viewerIsCreator = useMemo(() => {
    if (!exam || !user) return false
    if (isAdmin) return true
    return exam.createdBy._id === user.id
  }, [exam, user, isAdmin])

  const publishExamMutation = useMutation(
    async (examId: string) => {
      await examAPI.publishExam(examId)
    },
    {
      onSuccess: () => {
        toast.success('Exam published successfully')
        queryClient.invalidateQueries(['exam-details', id])
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Failed to publish exam'
        toast.error(message)
      }
    }
  )

  const unpublishExamMutation = useMutation(
    async (examId: string) => {
      await examAPI.unpublishExam(examId)
    },
    {
      onSuccess: () => {
        toast.success('Exam unpublished successfully')
        queryClient.invalidateQueries(['exam-details', id])
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Failed to unpublish exam'
        toast.error(message)
      }
    }
  )

  const deleteExamMutation = useMutation(
    async (examId: string) => {
      await examAPI.deleteExam(examId)
    },
    {
      onSuccess: () => {
        toast.success('Exam deleted successfully')
        queryClient.invalidateQueries(['exams'])
        navigate('/exams')
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Failed to delete exam'
        toast.error(message)
      }
    }
  )

  const questions = useMemo(() => {
    if (!exam?.questions) return []
    return exam.questions
  }, [exam])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <h1 className="text-2xl font-bold text-gray-800">Exam not found</h1>
            <p className="text-gray-500">We could not load the exam information. It may have been removed.</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allowStart = exam.isPublished && exam.status !== 'completed'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created by {exam.createdBy.name} · {formatDate(exam.createdAt)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {viewerIsCreator && (
            <Button variant="outline" onClick={() => navigate(`/exams/${exam.id}/edit`)}>
              Edit Exam
            </Button>
          )}
          {viewerIsCreator && (
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteExamMutation.isLoading) return
                const confirmed = window.confirm('Are you sure you want to delete this exam? This action cannot be undone.')
                if (!confirmed) return
                deleteExamMutation.mutate(exam.id)
              }}
              disabled={deleteExamMutation.isLoading}
            >
              {deleteExamMutation.isLoading ? 'Deleting…' : 'Delete Exam'}
            </Button>
          )}
          <Button onClick={() => navigate(`/exams/${exam.id}`)}>
            View Exam
          </Button>
        </div>
      </div>

      {/* Tabs for Details and Analytics */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="details">Exam Details</TabsTrigger>
          {viewerIsCreator && (
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics & Attempts
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
          {exam.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
                <CardDescription>Overview of the exam.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-line">{exam.description}</p>
              </CardContent>
            </Card>
          )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Exam Details</CardTitle>
            <CardDescription>Core settings for this exam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-semibold text-gray-800">Status</p>
                <p className="capitalize">{exam.status}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Total Questions</p>
                <p>{exam.questionCount}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Total Marks</p>
                <p>{exam.settings.totalMarks}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Duration</p>
                <p>{exam.settings.duration} minutes</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Passing Marks</p>
                <p>{exam.settings.passingMarks ?? 'Not set'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Attempts Allowed</p>
                <p>{exam.settings.maxAttempts}</p>
              </div>
            </div>

            <div className="border-t pt-4 text-sm text-gray-600 space-y-2">
              <p>
                <span className="font-semibold text-gray-800">Schedule:</span> {formatDate(exam.schedule.startDate)} – {formatDate(exam.schedule.endDate)} ({exam.schedule.timezone})
              </p>
              <p>
                <span className="font-semibold text-gray-800">Access:</span> {exam.access.type}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Settings:</span>{' '}
                {[
                  exam.settings.negativeMarking && 'Negative marking enabled',
                  exam.settings.randomizeQuestions && 'Randomize questions',
                  exam.settings.randomizeOptions && 'Randomize options',
                  exam.settings.preventTabSwitch && 'Tab switching prevented',
                  exam.settings.webcamMonitoring && 'Webcam monitoring active'
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Standard'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Start or review the exam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              disabled={!allowStart}
              onClick={() => navigate(`/exams/${exam.id}/take`)}
            >
              {allowStart ? 'Start Exam' : 'Exam not available yet'}
            </Button>
            {viewerIsCreator && (
              <div className="flex flex-col gap-2">
                {!exam.isPublished ? (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => publishExamMutation.mutate(exam.id)}
                    disabled={publishExamMutation.isLoading}
                  >
                    {publishExamMutation.isLoading ? 'Publishing…' : 'Publish Exam'}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => unpublishExamMutation.mutate(exam.id)}
                    disabled={unpublishExamMutation.isLoading}
                  >
                    {unpublishExamMutation.isLoading ? 'Unpublishing…' : 'Unpublish Exam'}
                  </Button>
                )}
              </div>
            )}
            <div className="text-xs text-gray-500 space-y-2">
              <p>Published: {exam.isPublished ? 'Yes' : 'No'}</p>
              <p>Current status: {exam.status}</p>
              <p>{exam.isActive ? 'Exam is currently active' : 'Exam is not active'}</p>
              {viewerIsCreator && (
                <p className="text-blue-600">You can manage this exam from the dashboard.</p>
              )}
              {isFetching && <p className="text-gray-400">Refreshing details…</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Questions Overview</CardTitle>
          <CardDescription>
            {viewerIsCreator || isAdmin ? 'Summary of the structured questions.' : 'Only the exam creator can view detailed questions.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!viewerIsCreator && !isAdmin ? (
            <p className="text-gray-500 text-sm">Questions are hidden, Start exam to view.</p>
          ) : questions.length === 0 ? (
            <p className="text-gray-500 text-sm">No questions found.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question._id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">Question {index + 1}</p>
                      <div className="text-sm text-gray-700 mt-2 leading-relaxed">
                        <MathText text={question.text} block />
                      </div>
                      {question.diagram?.present && question.diagram?.url && (
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
                    <span className="text-xs uppercase tracking-wide text-gray-500 ml-2">
                      {question.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  {question.options && question.options.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-800 mb-3">Options:</p>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const optionLabel = getOptionLabel(option)
                          const optionText = getOptionText(option)
                          const hasDiagram = hasOptionDiagram(option)
                          const diagramUrl = getOptionDiagramUrl(option)
                          
                          // Check if this is a correct answer - need to handle both string and object format
                          const correctAnswers = (question as any).correct || []
                          const isCorrectAnswer = correctAnswers.some((ans: string) => {
                            const normalizedAns = String(ans).replace(/[()\.:\-]/g, '').trim().toUpperCase()
                            const normalizedLabel = optionLabel.replace(/[()\.:\-]/g, '').trim().toUpperCase()
                            return normalizedAns === normalizedLabel
                          })
                          
                          return (
                            <div 
                              key={optionIndex} 
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                                isCorrectAnswer
                                  ? 'bg-gray-100 border-gray-400'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              {/* Icon indicator */}
                              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                isCorrectAnswer
                                  ? 'bg-gray-400 text-white'
                                  : 'bg-blue-500 text-white'
                              }`}>
                                <span className="text-base">{optionLabel}</span>
                              </div>
                              
                              <div className="flex-1">
                                <MathText text={optionText} className="text-sm text-gray-800" />
                                {hasDiagram && diagramUrl && (
                                  <img 
                                    src={diagramUrl} 
                                    alt={`Option ${optionLabel}`}
                                    className="mt-2 max-w-full h-auto max-h-32 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setModalImage({ 
                                      src: diagramUrl, 
                                      alt: `Option ${optionLabel} - Diagram` 
                                    })}
                                  />
                                )}
                              </div>

                              {/* Status icon on right - checkmark for correct answers */}
                              {isCorrectAnswer && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-500">
                                  <CheckCircle2 className="h-5 w-5 text-white" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Numeric/Descriptive Questions - Show correct answer */}
                  {(question.type === 'numeric' || question.type === 'descriptive') && (question as any).correct && (
                    <div className="mt-3">
                      <div className="p-3 rounded-lg border-2 bg-blue-50 border-blue-300">
                        <p className="text-xs font-medium text-gray-600 mb-1 uppercase">Correct Answer</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          <p className="text-sm font-medium text-gray-900">
                            {((question as any).correct || []).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 text-xs text-gray-500 flex items-center justify-between border-t border-gray-100 pt-2">
                    <p>Marks: {question.marks}</p>
                    {typeof question.order === 'number' && <p>Order: {question.order + 1}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* Analytics Tab - Only for Creators */}
        {viewerIsCreator && (
          <TabsContent value="analytics" className="mt-6">
            <ExamAnalytics examId={exam.id} />
          </TabsContent>
        )}
      </Tabs>

      <ImageModal 
        src={modalImage?.src || ''} 
        alt={modalImage?.alt || ''} 
        isOpen={!!modalImage} 
        onClose={() => setModalImage(null)} 
      />
    </div>
  )
}

export default ExamDetailsPage

import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from 'react-query'
import { examAPI, Question } from '@/lib/api'
import ExamWizard from '@/components/ExamWizard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LoadingSpinner from '@/components/LoadingSpinner'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface LoadedExam {
  id: string
  title: string
  description?: string
  settings: any
  schedule: any
  access: any
  questions: Question[]
  originalFiles?: {
    questionPaper?: {
      url?: string
    }
  }
}

const formatDateTimeLocal = (value?: string | Date) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const EditExamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [initialData, setInitialData] = useState<LoadedExam | null>(null)

  const {
    data,
    isLoading,
    isError,
    refetch
  } = useQuery(
    ['exam-to-edit', id],
    async () => {
      if (!id) {
        throw new Error('Missing exam identifier')
      }
      const response = await examAPI.getExamById(id, true)
      return response.data.exam as LoadedExam
    },
    {
      enabled: !!id,
      retry: false,
      onSuccess: (exam) => {
        const clonedQuestions = exam.questions?.map((question) => ({
          ...question,
          id: question._id || question.id
        }))

        setInitialData({
          id: exam.id,
          title: exam.title,
          description: exam.description,
          settings: exam.settings,
          schedule: {
            ...exam.schedule,
            startDate: formatDateTimeLocal(exam.schedule?.startDate),
            endDate: formatDateTimeLocal(exam.schedule?.endDate)
          },
          access: exam.access,
          originalFiles: exam.originalFiles,
          questions: clonedQuestions
        })
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Failed to load exam details'
        toast.error(message)
      }
    }
  )

  const updateExamMutation = useMutation(
    (payload: any) => {
      if (!id) {
        throw new Error('Missing exam identifier')
      }
      return examAPI.updateExam(id, payload)
    },
    {
      onSuccess: () => {
        toast.success('Exam updated successfully')
        navigate(`/exams/${id}`)
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Failed to update exam'
        toast.error(message)
      }
    }
  )

  const handleExamUpdate = (formData: any) => {
    updateExamMutation.mutate(formData)
  }

  if (isLoading || !initialData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card>
          <CardContent className="flex flex-col items-center space-y-4 py-12">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-500">Loading exam data...</p>
            {isError && (
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate(`/exams/${id}`)} className="flex items-center space-x-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exam</span>
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Exam</h1>
          <p className="text-gray-600 mt-2">
            Update exam details, schedule, and questions. Changes apply after saving.
          </p>
        </div>
      </div>

      <ExamWizard
        onComplete={handleExamUpdate}
        loading={updateExamMutation.isLoading}
        initialQuestions={initialData.questions}
        initialExamSettings={{
          title: initialData.title,
          description: initialData.description || '',
          settings: initialData.settings,
          schedule: initialData.schedule,
          access: initialData.access
        }}
        mode="edit"
        initialPdfUrl={initialData.originalFiles?.questionPaper?.url}
      />
    </div>
  )
}

export default EditExamPage

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'react-query'
import { examAPI, Question } from '@/lib/api'
import { Button } from '@/components/ui/button'
import ExamWizard from '@/components/ExamWizard'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const CreateExamPage: React.FC = () => {
  const navigate = useNavigate()
  const [_examData, setExamData] = useState<{
    title: string
    description: string
    settings: any
    schedule: any
    access: any
    questions: Question[]
  } | null>(null)

  const createExamMutation = useMutation(examAPI.createExam, {
    onSuccess: (response) => {
      toast.success('Exam created successfully!')
      navigate(`/exams/${response.data.exam.id}`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create exam'
      toast.error(message)
    }
  })

  const handleExamCreate = (data: any) => {
    setExamData(data)
    createExamMutation.mutate(data)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/exams')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Exams</span>
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Create New Exam</h1>
        <p className="text-muted-foreground mt-2">
          Upload your question paper and answer key, or create questions manually
        </p>
      </div>

      {/* Exam Wizard */}
      <ExamWizard
        onComplete={handleExamCreate}
        loading={createExamMutation.isLoading}
      />
    </div>
  )
}

export default CreateExamPage

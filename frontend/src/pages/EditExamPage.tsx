import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { examAPI, Question } from '@/lib/api'
import QuestionEditor from '@/components/QuestionEditor'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import Breadcrumbs from '@/components/Breadcrumbs'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const EditExamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [questions, setQuestions] = useState<Question[]>([])
  const [pdfUrl, setPdfUrl] = useState<string>('')

  const { data, isLoading } = useQuery(
    ['exam-to-edit', id],
    async () => {
      if (!id) throw new Error('Missing exam identifier')
      const response = await examAPI.getExamById(id, true)
      return response.data.exam
    },
    {
      enabled: !!id,
      onSuccess: (exam) => {
        const clonedQuestions = exam.questions?.map((question) => ({
          ...question,
          id: question._id || question.id
        })) || []
        setQuestions(clonedQuestions)
        if (exam.originalFiles?.questionPaper?.url) {
          setPdfUrl(exam.originalFiles.questionPaper.url)
        }
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to load exam details')
        navigate('/exams')
      }
    }
  )

  const updateExamMutation = useMutation(
    (updatedQuestions: Question[]) => {
      if (!id) throw new Error('Missing exam identifier')
      // Recalculate total marks
      const totalMarks = updatedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0)
      
      return examAPI.updateExam(id, {
        questions: updatedQuestions,
        settings: {
          ...data?.settings,
          totalMarks
        }
      })
    },
    {
      onSuccess: () => {
        toast.success('Questions updated successfully')
        queryClient.invalidateQueries(['exam-details', id])
        queryClient.invalidateQueries(['exams'])
        navigate(`/exams/${id}`)
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to update questions')
      }
    }
  )

  const handleSave = () => {
    if (questions.length === 0) {
      toast.error('At least one question is required')
      return
    }
    updateExamMutation.mutate(questions)
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[
        { label: 'Exams', href: '/exams' },
        { label: data.title, href: `/exams/${id}` },
        { label: 'Edit Questions' }
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edit Questions</h1>
          <p className="text-muted-foreground mt-1">Manage questions for {data.title}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/exams/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Exam
          </Button>
          <Button onClick={handleSave} disabled={updateExamMutation.isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {updateExamMutation.isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <QuestionEditor 
        questions={questions} 
        onQuestionsUpdate={setQuestions}
        pdfUrl={pdfUrl}
      />
    </div>
  )
}

export default EditExamPage

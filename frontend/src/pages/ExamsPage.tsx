import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { examAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

type ExamListItem = {
  id: string
  title: string
  description?: string
  createdBy: {
    name: string
    email: string
  }
  settings: {
    duration: number
    totalMarks: number
  }
  schedule: {
    startDate: string
    endDate: string
    timezone: string
  }
  access: {
    type: 'public' | 'private' | 'restricted'
  }
  status: 'draft' | 'published' | 'active' | 'completed' | 'archived'
  isPublished: boolean
  questionCount: number
  createdAt: string
  isActive?: boolean
}

type ExamsResponse = {
  exams: ExamListItem[]
  pagination: {
    current: number
    pages: number
    total: number
    limit: number
  }
}

const ExamsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isTeacher } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({ search: '' })

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchTerm.trim() }))
    }, 400)

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm])

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching
  } = useQuery<ExamsResponse>(
    ['exams', filters],
    async () => {
      const response = await examAPI.getExams({
        search: filters.search || undefined
      })
      return response.data as ExamsResponse
    },
    {
      keepPreviousData: true
    }
  )

  const exams = useMemo(() => data?.exams ?? [], [data])

  const queryClient = useQueryClient()
  const deleteExamMutation = useMutation(
    async (examId: string) => {
      await examAPI.deleteExam(examId)
    },
    {
      onSuccess: () => {
        toast.success('Exam deleted successfully')
        queryClient.invalidateQueries(['exams'])
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to delete exam'
        toast.error(message)
      }
    }
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exams</h1>
          <p className="text-gray-600 mt-1">
            Browse available exams and review their details.
          </p>
        </div>
        {isTeacher && (
          <Button onClick={() => navigate('/exams/create')} className="w-full sm:w-auto">
            Create Exam
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>Filter exams by title or description.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search exams..."
                className="pl-9"
                aria-label="Search exams"
              />
            </div>
            <div className="text-sm text-gray-500">
              {isFetching ? 'Updating results…' : `${data?.pagination.total ?? 0} exams found`}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center space-y-4">
            <p className="text-red-600 text-center">Failed to load exams. Please try again.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold text-gray-700">No exams found</h2>
            <p className="text-gray-500 mt-2">
              {filters.search
                ? 'Try adjusting your search keywords.'
                : 'When exams are created they will appear here.'}
            </p>
            {isTeacher && !filters.search && (
              <Button className="mt-4" onClick={() => navigate('/exams/create')}>
                Create your first exam
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl text-gray-900">{exam.title}</CardTitle>
                    {exam.description && (
                      <CardDescription className="mt-2 text-gray-600 line-clamp-2">
                        {exam.description}
                      </CardDescription>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      exam.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : exam.status === 'published'
                        ? 'bg-blue-100 text-blue-700'
                        : exam.status === 'draft'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {exam.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-800">Questions</p>
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
                    <p className="font-semibold text-gray-800">Access</p>
                    <p className="capitalize">{exam.access.type}</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>Created by {exam.createdBy.name}</p>
                  <p>Created {formatRelativeTime(exam.createdAt)}</p>
                  <p>
                    Scheduled {formatDate(exam.schedule.startDate)} – {formatDate(exam.schedule.endDate)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => navigate(`/exams/${exam.id}`)}>
                    View Details
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/exams/${exam.id}/take`)}>
                    Take Exam
                  </Button>
                  {isTeacher && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (deleteExamMutation.isLoading) return
                        const confirmed = window.confirm('Delete this exam? This cannot be undone.')
                        if (!confirmed) return
                        deleteExamMutation.mutate(exam.id)
                      }}
                      disabled={deleteExamMutation.isLoading}
                    >
                      {deleteExamMutation.isLoading ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default ExamsPage

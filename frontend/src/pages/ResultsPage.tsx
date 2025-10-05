import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import { resultAPI, Result } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatDate, formatRelativeTime, getGradeFromPercentage, getPerformanceColor } from '@/lib/utils'
import { AlertCircle, Award, BarChart3, Clock, Filter, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface ResultsResponse {
  results: Result[]
  pagination: {
    current: number
    pages: number
    total: number
    limit: number
  }
}

const ResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [filters, setFilters] = useState({ search: '', status: 'all', page: 1 })

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchTerm.trim(), page: 1 }))
      setPage(1)
    }, 400)

    return () => clearTimeout(handler)
  }, [searchTerm])

  useEffect(() => {
    setFilters((prev) => ({ ...prev, status: statusFilter, page }))
  }, [statusFilter, page])

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery<ResultsResponse>(
    ['user-results', filters],
    async () => {
      try {
        const response = await resultAPI.getUserResults({
          page: filters.page,
          limit: 10,
          status: filters.status === 'all' ? undefined : filters.status,
          search: filters.search || undefined
        })
        return response.data as ResultsResponse
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Failed to load results'
        throw new Error(message)
      }
    },
    {
      keepPreviousData: true,
      retry: false,
      onError: (err: any) => {
        toast.error(err.message)
      }
    }
  )

  const results = data?.results ?? []
  const pagination = data?.pagination

  const aggregate = useMemo(() => {
    if (!results.length) {
      return null
    }

    const totalAttempts = results.length
    const averageScore = Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / totalAttempts)
    const highestScore = Math.max(...results.map((r) => r.percentage || 0))
    const latestAttempt = results[0]

    return {
      totalAttempts,
      averageScore,
      highestScore,
      latestAttempt
    }
  }, [results])

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
    setPage(1)
  }

  const canGoPrev = pagination ? pagination.current > 1 : false
  const canGoNext = pagination ? pagination.current < (pagination.pages || 1) : false

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
          <p className="text-sm text-gray-500">Review your past exam attempts and analytics.</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filters</CardTitle>
          <CardDescription>Find specific attempts quickly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by exam title or description"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <div className="flex gap-2">
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Submitted', value: 'submitted' },
                  { label: 'Auto Submitted', value: 'auto_submitted' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={statusFilter === option.value ? 'default' : 'outline'}
                    onClick={() => handleStatusChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          {pagination && (
            <p className="text-xs text-gray-500">
              Showing {results.length} of {pagination.total} attempts
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-800">Unable to load results</h2>
            <p className="text-gray-500">{(error as any)?.message || 'Please try again later.'}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <h2 className="text-xl font-semibold text-gray-800">No results found</h2>
            <p className="text-gray-500">Complete an exam to view your performance here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {aggregate && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-sm text-blue-700">Total Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-900">{aggregate.totalAttempts}</p>
                </CardContent>
              </Card>
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="text-sm text-green-700">Average Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${getPerformanceColor(aggregate.averageScore)}`}>
                    {aggregate.averageScore}%
                  </p>
                </CardContent>
              </Card>
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="text-sm text-purple-700">Best Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${getPerformanceColor(aggregate.highestScore)}`}>
                    {aggregate.highestScore}%
                  </p>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-700">Latest Attempt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-gray-600">
                  <p className="text-gray-900 font-medium">{aggregate.latestAttempt.exam.title}</p>
                  <p>Score: {aggregate.latestAttempt.score} / {aggregate.latestAttempt.totalMarks}</p>
                  <p>Submitted {formatRelativeTime(aggregate.latestAttempt.timing.submittedAt || aggregate.latestAttempt.timing.startedAt)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4">
            {results.map((item) => {
              const grade = getGradeFromPercentage(item.percentage)
              const performance = getPerformanceColor(item.percentage)

              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl text-gray-900">{item.exam.title}</CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                          Attempt #{item.attemptNumber} · {formatDate(item.timing.startedAt)}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-semibold ${performance}`}>{item.percentage}%</p>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Grade {grade}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs uppercase text-gray-400">Score</p>
                        <p className="text-gray-900 font-medium">{item.score} / {item.totalMarks}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400">Status</p>
                        <p className="capitalize">{item.status.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400">Time Spent</p>
                        <p>{Math.round(item.timing.totalTimeSpent / 60)} min</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-gray-400">Submitted</p>
                        <p>{item.timing.submittedAt ? formatRelativeTime(item.timing.submittedAt) : 'Pending submission'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Award className="h-4 w-4 text-green-600" />
                        <span>Correct: {item.analytics?.correctAnswers ?? '-'}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <BarChart3 className="h-4 w-4 text-red-500" />
                        <span>Incorrect: {item.analytics?.incorrectAnswers ?? '-'}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span>Avg time/question: {item.analytics?.averageTimePerQuestion ?? '-'}s</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => navigate(`/results/${item.id}`)} size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/exams/${item.exam.id}`)}>
                        View Exam
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-gray-500">
                Page {pagination.current} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={!canGoPrev} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                  Previous
                </Button>
                <Button variant="outline" disabled={!canGoNext} onClick={() => setPage((prev) => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ResultsPage

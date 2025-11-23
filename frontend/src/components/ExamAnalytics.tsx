import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { resultAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatDate, calculatePercentage, getPerformanceColor, getGradeFromPercentage } from '@/lib/utils'
import {
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye
} from 'lucide-react'

interface ExamAnalyticsProps {
  examId: string
}

const ExamAnalytics: React.FC<ExamAnalyticsProps> = ({ examId }) => {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading } = useQuery(
    ['exam-attempts', examId, page, statusFilter],
    async () => {
      // @ts-ignore - getExamResults exists but TypeScript cache not updated
      const response = await resultAPI.getExamResults(examId, {
        page,
        limit: 20,
        status: statusFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      return response.data
    },
    {
      enabled: !!examId,
      keepPreviousData: true
    }
  )

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const results = data?.results || []
  const pagination = data?.pagination
  const analytics = data?.aggregateAnalytics

  return (
    <div className="space-y-6">
      {/* Aggregate Analytics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Attempts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{analytics.totalAttempts}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.completedAttempts} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Average Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{Number(analytics.averageScore).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                out of {analytics.totalMarks}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Award className="h-4 w-4 text-green-600" />
                Highest Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{Number(analytics.highestScore).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {calculatePercentage(analytics.highestScore, analytics.totalMarks).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Lowest Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${analytics.lowestScore < 0 ? 'text-red-700' : 'text-red-600'}`}>
                {Number(analytics.lowestScore).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {calculatePercentage(analytics.lowestScore, analytics.totalMarks).toFixed(1)}%
                {analytics.lowestScore < 0 && ' (Negative)'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>All Attempts</CardTitle>
          <CardDescription>View detailed analytics for each attempt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          {/* Results Table */}
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No attempts yet for this exam</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result: any) => {
                const percentage = calculatePercentage(result.score, result.totalMarks)
                const performanceColor = getPerformanceColor(percentage)
                const grade = getGradeFromPercentage(percentage)

                return (
                  <Card key={result.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-gray-900">{result.user.name}</p>
                              <p className="text-sm text-gray-500">{result.user.email}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              result.status === 'completed' || result.status === 'submitted'
                                ? 'bg-green-100 text-green-800'
                                : result.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {result.status}
                            </span>
                            {result.cheatingFlags && result.cheatingFlags.length > 0 && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {result.cheatingFlags.length} flag{result.cheatingFlags.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-500">Score</p>
                              <p className={`font-semibold ${performanceColor}`}>
                                {Number(result.score).toFixed(2)} / {result.totalMarks}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Percentage</p>
                              <p className={`font-semibold ${percentage < 0 ? 'text-red-700' : ''}`}>
                                {percentage.toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Grade</p>
                              <p className="font-semibold">{grade}</p>
                            </div>
                            {result.analytics && (
                              <>
                                <div>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                    Correct
                                  </p>
                                  <p className="font-semibold">{result.analytics.correctAnswers}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <XCircle className="h-3 w-3 text-red-600" />
                                    Wrong
                                  </p>
                                  <p className="font-semibold">{result.analytics.incorrectAnswers}</p>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Attempt #{result.attemptNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.timing?.totalTimeSpent ? `${Math.round(result.timing.totalTimeSpent / 60)}m` : 'N/A'}
                            </span>
                            <span>{formatDate(result.createdAt)}</span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/results/${result.id}`, '_blank')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.current} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExamAnalytics


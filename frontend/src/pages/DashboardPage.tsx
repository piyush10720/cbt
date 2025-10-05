import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from 'react-query'
import { examAPI, resultAPI } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  BookOpen,
  FileText,
  TrendingUp,
  Clock,
  Users,
  Award,
  Plus,
  Eye
} from 'lucide-react'
import { formatDate, formatRelativeTime, getPerformanceColor } from '@/lib/utils'

const DashboardPage: React.FC = () => {
  const { user, isTeacher, isStudent } = useAuth()
  const navigate = useNavigate()

  // Fetch recent exams
  const { data: examsData, isLoading: examsLoading } = useQuery(
    ['exams', 'recent'],
    () => examAPI.getExams({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    { enabled: !!user }
  )

  // Fetch user results (for students)
  const { data: resultsData, isLoading: resultsLoading } = useQuery(
    ['results', 'recent'],
    () => resultAPI.getUserResults({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    { enabled: isStudent }
  )

  // Fetch user's created exams (for teachers)
  const { data: myExamsData, isLoading: myExamsLoading } = useQuery(
    ['exams', 'mine'],
    () => examAPI.getExams({ createdBy: 'me', limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    { enabled: isTeacher }
  )

  const stats = user?.stats || {
    totalExams: 0,
    averageScore: 0,
    bestScore: 0,
    recentActivity: []
  }

  if (examsLoading || resultsLoading || myExamsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-2">
          {isTeacher 
            ? "Manage your exams and track student performance"
            : "Continue your learning journey and track your progress"
          }
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {isStudent && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalExams}</div>
                <p className="text-xs text-muted-foreground">
                  Exams attempted
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(stats.averageScore)}`}>
                  {stats.averageScore}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Overall performance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Best Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getPerformanceColor(stats.bestScore)}`}>
                  {stats.bestScore}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Highest achievement
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recentActivity.length}</div>
                <p className="text-xs text-muted-foreground">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {isTeacher && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Exams</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {myExamsData?.data.pagination.total || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Exams created
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {myExamsData?.data.exams.filter(e => e.isPublished).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active exams
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Drafts</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {myExamsData?.data.exams.filter(e => !e.isPublished).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending publication
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">
                  Total participants
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Exams */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {isTeacher ? 'My Recent Exams' : 'Available Exams'}
              </CardTitle>
              <CardDescription>
                {isTeacher 
                  ? 'Exams you have created recently'
                  : 'Latest exams available for you'
                }
              </CardDescription>
            </div>
            {isTeacher && (
              <Button
                onClick={() => navigate('/exams/create')}
                size="sm"
                className="flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(isTeacher ? myExamsData?.data.exams : examsData?.data.exams)?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>
                    {isTeacher 
                      ? 'No exams created yet. Create your first exam!'
                      : 'No exams available at the moment.'
                    }
                  </p>
                </div>
              ) : (
                (isTeacher ? myExamsData?.data.exams : examsData?.data.exams)?.map((exam) => (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{exam.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {exam.description || 'No description'}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span>{exam.questionCount} questions</span>
                        <span>{exam.settings.duration} minutes</span>
                        <span>{formatRelativeTime(exam.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        exam.isPublished 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exam.isPublished ? 'Published' : 'Draft'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/exams/${exam.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/exams')}
                className="w-full"
              >
                View All Exams
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Results (Students only) */}
        {isStudent && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Results</CardTitle>
              <CardDescription>
                Your latest exam performances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {resultsData?.data.results.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No exam results yet. Take your first exam!</p>
                  </div>
                ) : (
                  resultsData?.data.results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {result.exam.title}
                        </h3>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>Score: {result.score}/{result.totalMarks}</span>
                          <span className={`font-medium ${getPerformanceColor(result.percentage)}`}>
                            {result.percentage}%
                          </span>
                          <span>{formatRelativeTime(result.createdAt)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/results/${result.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/results')}
                  className="w-full"
                >
                  View All Results
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions (Teachers only) */}
        {isTeacher && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/exams/create')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Exam
                </Button>
                <Button
                  onClick={() => navigate('/exams')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Manage Exams
                </Button>
                <Button
                  onClick={() => navigate('/results')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default DashboardPage

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import SEO from '@/components/SEO'
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
  FolderPlus,
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react'
import { formatRelativeTime, getPerformanceColor } from '@/lib/utils'
import { motion } from 'framer-motion'

const DashboardPage = () => {
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

  // Fetch paused exams
  const { data: pausedExamsData } = useQuery(
    ['results', 'paused'],
    () => resultAPI.getUserResults({ status: 'paused', limit: 3, sortBy: 'updatedAt', sortOrder: 'desc' }),
    { enabled: !!user }
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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      <SEO 
        title="Dashboard" 
        description="View your recent exams and performance statistics." 
        image="https://res.cloudinary.com/dwvy7icmo/image/upload/v1764256697/cbt-assets/cbt-teacher-dashboard.png"
      />
      {/* Welcome Section */}
      <motion.div variants={item} className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-purple-600 p-8 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold md:text-4xl">
            Welcome back, {user?.name}!
          </h1>
          <p className="mt-2 text-primary-foreground/90 text-lg max-w-2xl">
            {isTeacher 
              ? "Ready to inspire? Manage your exams and track student performance efficiently."
              : "Continue your learning journey. Track your progress and achieve your goals."
            }
          </p>
          <div className="mt-6 flex gap-4">
            {isTeacher ? (
              <Button variant="secondary" size="lg" onClick={() => navigate('/exams/create')} className="shadow-lg">
                <Plus className="mr-2 h-5 w-5" />
                Create New Exam
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={() => navigate('/exams')} className="shadow-lg">
                <BookOpen className="mr-2 h-5 w-5" />
                Browse Exams
              </Button>
            )}
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
      </motion.div>


      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isStudent && (
          <>
            <StatsCard 
              title="Total Exams" 
              value={stats.totalExams} 
              description="Exams attempted" 
              icon={BookOpen} 
              color="text-blue-600 dark:text-blue-400"
              bg="bg-blue-500/10"
            />
            <StatsCard 
              title="Average Score" 
              value={`${stats.averageScore}%`} 
              description="Overall performance" 
              icon={TrendingUp} 
              color={getPerformanceColor(stats.averageScore).replace('text-', 'text-')} // Keep it simple for now or map colors
              bg="bg-green-500/10"
            />
            <StatsCard 
              title="Best Score" 
              value={`${stats.bestScore}%`} 
              description="Highest achievement" 
              icon={Award} 
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-500/10"
            />
            <StatsCard 
              title="Recent Activity" 
              value={stats.recentActivity.length} 
              description="Last 30 days" 
              icon={Clock} 
              color="text-purple-600 dark:text-purple-400"
              bg="bg-purple-500/10"
            />
          </>
        )}

        {isTeacher && (
          <>
            <StatsCard 
              title="My Exams" 
              value={myExamsData?.data.pagination.total || 0} 
              description="Exams created" 
              icon={FileText} 
              color="text-blue-600 dark:text-blue-400"
              bg="bg-blue-500/10"
            />
            <StatsCard 
              title="Published" 
              value={myExamsData?.data.stats?.totalPublished || 0} 
              description="Active exams" 
              icon={BookOpen} 
              color="text-green-600 dark:text-green-400"
              bg="bg-green-500/10"
            />
            <StatsCard 
              title="Drafts" 
              value={myExamsData?.data.stats?.totalDrafts || 0} 
              description="Pending publication" 
              icon={Clock} 
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-500/10"
            />
            <StatsCard 
              title="Students" 
              value={0} 
              description="Total participants" 
              icon={Users} 
              color="text-purple-600 dark:text-purple-400"
              bg="bg-purple-500/10"
            />
          </>
        )}
      </motion.div>

            {/* Paused Exams Section */}
      {pausedExamsData?.data.results && pausedExamsData.data.results.length > 0 && (
        <motion.div variants={item} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-500" />
              Paused Exams
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pausedExamsData.data.results.map((result: any) => (
              <Card key={result.id} className="hover:shadow-md transition-all border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-1">{result.exam?.title || 'Unknown Exam'}</CardTitle>
                  <CardDescription>
                    Paused {formatRelativeTime(result.updatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Progress</span>
                      <span>{result.answers?.length || 0} answered</span>
                    </div>
                    <Button 
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => result.exam?.id && navigate(`/exams/${result.exam.id}/take`)}
                      disabled={!result.exam}
                    >
                      Resume Exam
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Exams / Main Content */}
        <motion.div variants={item} className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">
              {isTeacher ? 'My Recent Exams' : 'Available Exams'}
            </h2>
            <Button variant="ghost" className="text-primary hover:text-primary/80" onClick={() => navigate('/exams')}>
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {(isTeacher ? myExamsData?.data.exams : examsData?.data.exams)?.length === 0 ? (
              <Card className="border-dashed border-muted">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No exams found</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm">
                    {isTeacher 
                      ? 'Get started by creating your first exam. It only takes a few minutes.'
                      : 'Check back later for new exams or browse the catalog.'
                    }
                  </p>
                  {isTeacher && (
                    <Button className="mt-4" onClick={() => navigate('/exams/create')}>
                      Create Exam
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              (isTeacher ? myExamsData?.data.exams : examsData?.data.exams)?.map((exam) => (
                <motion.div 
                  key={exam.id}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary"
                    onClick={() => navigate(`/exams/${exam.id}`)}
                  >
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg text-foreground truncate">{exam.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            exam.isPublished 
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {exam.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                          {exam.description || 'No description provided'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center"><FileText className="w-3 h-3 mr-1" /> {exam.questionCount} Qs</span>
                          <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {exam.settings.duration} min</span>
                          <span>{formatRelativeTime(exam.createdAt)}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Sidebar: Quick Actions & Results */}
        <motion.div variants={item} className="space-y-8">
          {/* Quick Actions (Teachers) */}
          {isTeacher && (
            <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-gray-900 to-gray-800 text-white dark:from-gray-800 dark:to-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                <Button 
                  variant="secondary" 
                  className="w-full justify-start h-12 text-gray-900 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => navigate('/exams/create')}
                >
                  <Plus className="mr-2 h-4 w-4" /> Create New Exam
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start h-12 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate('/exams?createFolder=true')}
                >
                  <FolderPlus className="mr-2 h-4 w-4" /> New Folder
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start h-12 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate('/results')}
                >
                  <TrendingUp className="mr-2 h-4 w-4" /> View Analytics
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent Results (Students) */}
          {isStudent && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Performance</CardTitle>
                <CardDescription>Your latest results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resultsData?.data.results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Award className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm">No results yet.</p>
                  </div>
                ) : (
                  resultsData?.data.results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/results/${result.id}`)}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-medium text-sm text-foreground truncate">{result.exam.title}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(result.createdAt)}</p>
                      </div>
                      <div className={`font-bold text-sm ${getPerformanceColor(result.percentage)}`}>
                        {result.percentage}%
                      </div>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full text-xs" onClick={() => navigate('/results')}>
                  View All Results
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}

const StatsCard = ({ title, value, description, icon: Icon, color, bg }: any) => (
  <Card className="overflow-hidden transition-all hover:shadow-md">
    <CardContent className="p-6">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`p-2 rounded-full ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <div className="flex flex-col mt-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground mt-1">{description}</span>
      </div>
    </CardContent>
  </Card>
)

export default DashboardPage

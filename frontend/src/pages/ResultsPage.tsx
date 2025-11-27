import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import { resultAPI, Result } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatDate, formatRelativeTime, getGradeFromPercentage, getPerformanceColor } from '@/lib/utils'
// Breadcrumbs not used in this component
import { 
  AlertCircle, 
  Award, 
  BarChart3, 
  Clock, 
  Filter, 
  Search, 
  Trophy, 
  Target,
  Calendar,
  ArrowRight,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import SEO from '@/components/SEO'

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
    <div className="space-y-8 pb-12">
      <SEO title="Results" description="Track your progress and analyze your performance." />
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Exam Results</h1>
          <p className="text-muted-foreground mt-1">Track your progress and analyze your performance.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={() => refetch()} variant="outline" disabled={isFetching} className="gap-2">
            <Clock className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {aggregate && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Total Attempts" 
            value={aggregate.totalAttempts} 
            icon={Trophy}
            color="bg-blue-500"
            trend="Lifetime"
          />
          <StatsCard 
            title="Average Score" 
            value={`${aggregate.averageScore}%`} 
            icon={Target}
            color="bg-purple-500"
            trend="Overall"
          />
          <StatsCard 
            title="Best Score" 
            value={`${aggregate.highestScore}%`} 
            icon={Award}
            color="bg-amber-500"
            trend="Personal Best"
          />
          <StatsCard 
            title="Latest Activity" 
            value={formatRelativeTime(aggregate.latestAttempt.timing.submittedAt || aggregate.latestAttempt.timing.startedAt)} 
            icon={Clock}
            color="bg-green-500"
            trend={aggregate.latestAttempt.exam.title}
          />
        </div>
      )}

      {/* Search and Filter Bar */}
      <Card className="border-none shadow-sm bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search exams..."
                className="pl-9 bg-background border-muted focus:border-primary transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-2">
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Submitted', value: 'submitted' },
                  { label: 'Pending', value: 'auto_submitted' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={statusFilter === option.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleStatusChange(option.value)}
                    className="whitespace-nowrap"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold text-destructive">Unable to load results</h2>
            <p className="text-muted-foreground">{(error as any)?.message || 'Please try again later.'}</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No results found</h3>
          <p className="text-muted-foreground mt-1 mb-6">Complete an exam to see your performance analytics here.</p>
          <Button onClick={() => navigate('/exams')}>Browse Exams</Button>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {results.map((result) => {
            const grade = getGradeFromPercentage(result.percentage)
            const performanceColor = getPerformanceColor(result.percentage)
            
            return (
              <motion.div variants={item} key={result.id}>
                <Card className="group hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Left: Exam Info */}
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors mb-1">
                            {result.exam.title}
                          </h3>
                          <div className="flex items-center text-sm text-muted-foreground gap-4">
                            <span className="flex items-center">
                              <Calendar className="w-3.5 h-3.5 mr-1" />
                              {formatDate(result.timing.startedAt)}
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              {Math.round(result.timing.totalTimeSpent / 60)} mins
                            </span>
                          </div>
                        </div>
                        <Badge variant={
                          result.status === 'completed' ? 'default' : 
                          result.status === 'submitted' ? 'secondary' : 'outline'
                        }>
                          {result.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Score</p>
                          <p className="font-semibold">{result.score} / {result.totalMarks}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Correct</p>
                          <div className="flex items-center text-green-600 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {result.analytics?.correctAnswers ?? '-'}
                          </div>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Incorrect</p>
                          <div className="flex items-center text-red-500 font-medium">
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            {result.analytics?.incorrectAnswers ?? '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Score & Actions */}
                    <div className="md:w-64 bg-muted/10 p-6 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l">
                      <div className="text-center mb-4">
                        <span className={`text-4xl font-bold ${performanceColor}`}>
                          {result.percentage}%
                        </span>
                        <p className="text-sm text-muted-foreground font-medium mt-1">Grade {grade}</p>
                      </div>
                      
                      <div className="w-full space-y-2">
                        <Button className="w-full" onClick={() => navigate(`/results/${result.id}`)}>
                          View Analysis <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => navigate(`/exams/${result.exam.id}`)}>
                          View Exam Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Page {pagination.current} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              disabled={!canGoPrev} 
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              disabled={!canGoNext} 
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const StatsCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <Card className="overflow-hidden border-none shadow-md relative">
    <div className={`absolute top-0 right-0 p-4 opacity-10 ${color.replace('bg-', 'text-')}`}>
      <Icon className="w-16 h-16" />
    </div>
    <CardContent className="p-6 relative z-10">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white shadow-lg mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      <p className="text-xs text-muted-foreground mt-2 truncate max-w-[140px]">{trend}</p>
    </CardContent>
  </Card>
)

export default ResultsPage

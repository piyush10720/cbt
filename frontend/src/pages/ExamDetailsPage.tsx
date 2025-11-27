import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { examAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatRelativeTime } from '@/lib/utils'
import {
  Clock,
  FileText,
  Calendar,
  Settings,
  Play,
  Edit,
  MoreVertical,
  Trash2,
  CheckCircle2,
  BarChart3,
  Users,
  ArrowLeft,
  Eye,
  BookOpen
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import toast from 'react-hot-toast'
import QuestionCard from '@/components/QuestionCard'

const ExamDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isTeacher } = useAuth()
  const queryClient = useQueryClient()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const { data: exam, isLoading, error } = useQuery(
    ['exam', id],
    () => examAPI.getExamById(id!, true).then(res => res.data.exam),
    { enabled: !!id }
  )

  const deleteExamMutation = useMutation(
    async () => {
      await examAPI.deleteExam(id!)
    },
    {
      onSuccess: () => {
        toast.success('Exam deleted successfully')
        navigate('/exams')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete exam')
      }
    }
  )

  const publishExamMutation = useMutation(
    async () => {
      if (exam?.isPublished) {
        await examAPI.unpublishExam(id!)
      } else {
        await examAPI.publishExam(id!)
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['exam', id])
        toast.success(`Exam ${exam?.isPublished ? 'unpublished' : 'published'} successfully`)
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update exam status')
      }
    }
  )

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>
  if (error || !exam) return <div className="text-center py-12">Exam not found</div>

  const isOwner = user && exam.createdBy._id === user.id

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Hero Header */}
      <div className="relative bg-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-purple-900/90 z-0" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 z-0" />
        
        <div className="relative z-10 w-full px-4 py-12 sm:py-16">
          <Button 
            variant="ghost" 
            className="text-white/70 hover:text-white hover:bg-white/10 mb-6 pl-0"
            onClick={() => navigate('/exams')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams
          </Button>
          
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant={exam.isPublished ? "default" : "secondary"} className="bg-white/20 hover:bg-white/30 text-white border-none">
                  {exam.isPublished ? 'Published' : 'Draft'}
                </Badge>
                <span className="text-white/60 text-sm flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Created {formatRelativeTime(exam.createdAt)}
                </span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{exam.title}</h1>
              <p className="text-lg text-white/80 max-w-2xl leading-relaxed">
                {exam.description || "No description provided for this exam."}
              </p>
              
              <div className="flex flex-wrap gap-6 mt-8 text-sm font-medium text-white/90">
                <div className="flex items-center bg-white/10 px-3 py-1.5 rounded-full">
                  <FileText className="w-4 h-4 mr-2" />
                  {exam.questions?.length || 0} Questions
                </div>
                <div className="flex items-center bg-white/10 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4 mr-2" />
                  {exam.settings.duration} Minutes
                </div>
                <div className="flex items-center bg-white/10 px-3 py-1.5 rounded-full">
                  <Users className="w-4 h-4 mr-2" />
                  {exam.access.type === 'public' ? 'Public Access' : 'Private Access'}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <Button 
                size="lg" 
                className="w-full shadow-lg text-lg h-12"
                onClick={() => navigate(`/exams/${id}/take`)}
              >
                <Play className="mr-2 h-5 w-5" /> Start Exam
              </Button>
              
              {isOwner && (
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 bg-white/10 text-white hover:bg-white/20 border-none"
                    onClick={() => navigate(`/exams/${id}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-none px-3">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => publishExamMutation.mutate()}>
                        <Eye className="mr-2 h-4 w-4" />
                        {exam.isPublished ? 'Unpublish' : 'Publish'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/exams/${id}/settings`)}>
                        <Settings className="mr-2 h-4 w-4" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => setIsDeleteModalOpen(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-8 -mt-8">
        <Card className="shadow-xl border-none">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b px-6">
                <TabsList className="h-14 bg-transparent space-x-6">
                  <TabsTrigger 
                    value="overview" 
                    className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 text-base"
                  >
                    Overview
                  </TabsTrigger>
                  {isOwner && <TabsTrigger 
                    value="questions" 
                    className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 text-base"
                  >
                    Questions
                  </TabsTrigger>}
                  {isOwner && (
                    <TabsTrigger 
                      value="analytics" 
                      className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 text-base"
                    >
                      Analytics
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="overview" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Settings className="w-5 h-5 mr-2 text-primary" />
                          Exam Configuration
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <ConfigItem label="Duration" value={`${exam.settings.duration} mins`} />
                          <ConfigItem label="Total Marks" value={exam.settings.totalMarks} />
                          <ConfigItem label="Passing Marks" value={exam.settings.passingMarks as number} />
                          <ConfigItem label="Negative Marking" value={exam.settings.negativeMarking ? "Yes" : "No"} />
                          <ConfigItem label="Shuffle Questions" value={exam.settings.randomizeQuestions ? "Yes" : "No"} />
                          <ConfigItem label="Show Results" value={exam.settings.showResultImmediately ? "Immediately" : "Later"} />
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <BookOpen className="w-5 h-5 mr-2 text-primary" />
                          Instructions
                        </h3>
                        <div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground leading-relaxed">
                          <ul className="list-disc list-inside space-y-2">
                            <li>Read all questions carefully before answering.</li>
                            <li>You can navigate between questions using the question palette.</li>
                            <li>Ensure you have a stable internet connection.</li>
                            <li>Do not refresh the page during the exam.</li>
                            {exam.settings.negativeMarking && (
                              <li className="text-amber-600 font-medium">Negative marking is enabled for incorrect answers.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <Card className="bg-primary/5 border-primary/10">
                        <CardHeader>
                          <CardTitle className="text-lg">Ready to start?</CardTitle>
                          <CardDescription>Make sure you are prepared before beginning.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <span className="text-sm">Stable internet connection check</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <span className="text-sm">Browser compatibility check</span>
                            </div>
                            <Button className="w-full mt-4" onClick={() => navigate(`/exams/${id}/take`)}>
                              Start Exam Now
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="questions" className="mt-0">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Questions Preview ({exam.questions?.length || 0})</h3>
                      {isOwner && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/exams/${id}/edit`)}>
                          <Edit className="w-4 h-4 mr-2" /> Edit Questions
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {exam.questions?.map((question: any, index: number) => (
                        <div key={question.id || index} className="space-y-2">
                          <div className="flex items-center gap-2 ml-1">
                            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                              Question {index + 1}
                            </Badge>
                          </div>
                          
                          <QuestionCard
                            question={{
                              id: question.id,
                              text: question.text,
                              type: question.type,
                              options: question.options,
                              imageUrl: question.imageUrl || question.diagram?.url,
                              marks: question.marks,
                              tags: question.tags,
                              explanation: question.explanation
                            }}
                            correctAnswer={question.correct}
                            showCorrectAnswer={isOwner as boolean}
                            showUserAnswer={false}
                            showExplanation={true}
                            showTags={true}
                            isGradingEnabled={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {isOwner && (
                  <TabsContent value="analytics" className="mt-0">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <BarChart3 className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium">Analytics Dashboard</h3>
                      <p className="text-muted-foreground max-w-md mt-2 mb-6">
                        Detailed performance analytics and student results will be displayed here.
                      </p>
                      <Button onClick={() => navigate('/results')}>
                        View All Results
                      </Button>
                    </div>
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{exam.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteExamMutation.mutate()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const ConfigItem = ({ label, value }: { label: string, value: string | number }) => (
  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
)

export default ExamDetailsPage

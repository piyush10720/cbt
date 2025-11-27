import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { examAPI, folderAPI, Folder, Exam } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatRelativeTime } from '@/lib/utils'
import { 
  Search, 
  Folder as FolderIcon, 
  FileText, 
  ChevronRight, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit,
  Eye,
  CheckSquare,
  Square,
  Settings,
  FolderInput,
  LayoutGrid,
  List as ListIcon,
  FolderOpen,
  Clock,
  Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion, AnimatePresence } from 'framer-motion'
import SEO from '@/components/SEO'

const ExamsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isTeacher } = useAuth()
  const queryClient = useQueryClient()
  
  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set())
  const [selectedExamsDetails, setSelectedExamsDetails] = useState<Exam[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Modals
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderVisibility, setNewFolderVisibility] = useState<'owner' | 'invited' | 'public'>('owner')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  
  const [_isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [_mergeConfig, _setMergeConfig] = useState({
    title: '',
    description: '',
    settings: {
      duration: 60,
      negativeMarking: false,
      randomizeQuestions: false,
      randomizeOptions: false,
      showResultImmediately: true,
      allowReview: true,
      preventTabSwitch: true,
      webcamMonitoring: false,
      maxAttempts: 1,
      allowCalculator: false
    },
    schedule: {
      startDate: new Date().toISOString().slice(0, 16),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      timezone: 'UTC'
    },
    access: {
      type: 'private',
      requireApproval: false
    }
  })
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null)
  
  // Move Modal State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [itemsToMove, setItemsToMove] = useState<{ id: string, type: 'exam' | 'folder' }[]>([])
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)

  // Fetch Folders (All for Tree, Subfolders for View)
  const { data: allFoldersData } = useQuery(
    ['folders', 'all'],
    () => folderAPI.getFolders('all').then(res => res.data),
    { enabled: !!user }
  )

  // Fetch Exams
  const {
    data: examsData,
    isLoading: isExamsLoading
  } = useQuery(
    ['exams', currentFolderId, searchTerm],
    () => examAPI.getExams({
      search: searchTerm || undefined,
      folderId: currentFolderId || 'all'
    }).then(res => res.data),
    { keepPreviousData: true }
  )

  // Derived Data
  const allFolders = allFoldersData || []
  const currentSubfolders = allFolders.filter(f => f.parent === currentFolderId)
  const exams = examsData?.exams || []
  
  // Handle query params
  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('createFolder') === 'true') {
      setIsCreateFolderOpen(true)
    }
  }, [searchParams])

  // Build Folder Tree
  const folderTree = useMemo(() => {
    const tree: Record<string, Folder[]> = {}
    allFolders.forEach(f => {
      const pid = f.parent || 'root'
      if (!tree[pid]) tree[pid] = []
      tree[pid].push(f)
    })
    return tree
  }, [allFolders])

  // Mutations
  const createFolderMutation = useMutation(
    async (name: string) => {
      await folderAPI.createFolder({ 
        name, 
        parent: currentFolderId,
        visibility: newFolderVisibility,
        description: newFolderDescription
      })
    },
    {
      onSuccess: () => {
        toast.success('Folder created')
        setIsCreateFolderOpen(false)
        setNewFolderName('')
        setNewFolderDescription('')
        setNewFolderVisibility('owner')
        queryClient.invalidateQueries(['folders'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create folder')
      }
    }
  )

  const deleteFolderMutation = useMutation(
    async (id: string) => {
      await folderAPI.deleteFolder(id)
    },
    {
      onSuccess: () => {
        toast.success('Folder deleted')
        queryClient.invalidateQueries(['folders'])
        setFolderToDelete(null)
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete folder')
      }
    }
  )

  const deleteExamMutation = useMutation(
    async (id: string) => {
      await examAPI.deleteExam(id)
    },
    {
      onSuccess: () => {
        toast.success('Exam deleted')
        queryClient.invalidateQueries(['exams'])
        setExamToDelete(null)
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete exam')
      }
    }
  )


  const publishExamMutation = useMutation(
    async (id: string) => {
      await examAPI.publishExam(id)
    },
    {
      onSuccess: () => {
        toast.success('Exam published')
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to publish exam')
      }
    }
  )

  const unpublishExamMutation = useMutation(
    async (id: string) => {
      await examAPI.unpublishExam(id)
    },
    {
      onSuccess: () => {
        toast.success('Exam unpublished')
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to unpublish exam')
      }
    }
  )

  const moveItemsMutation = useMutation(
    async () => {
      if (!targetFolderId) return

      const promises = itemsToMove.map(async (item) => {
        if (item.type === 'exam') {
          await folderAPI.addExamToFolder(item.id, targetFolderId)
          if (currentFolderId) {
             await folderAPI.removeExamFromFolder(item.id, currentFolderId)
          }
        } else {
          await folderAPI.updateFolder(item.id, { parent: targetFolderId === 'root' ? null : targetFolderId })
        }
      })

      await Promise.all(promises)
    },
    {
      onSuccess: () => {
        toast.success(`Successfully moved ${itemsToMove.length} item${itemsToMove.length !== 1 ? 's' : ''}`)
        setIsMoveModalOpen(false)
        setItemsToMove([])
        setTargetFolderId(null)
        setSelectedExamIds(new Set())
        setSelectedExamsDetails([])
        queryClient.invalidateQueries(['folders'])
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to move items')
      }
    }
  )

  // Handlers
  const toggleFolderExpand = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }
  const toggleExamSelection = (exam: Exam) => {
    const canMerge = exam.access.type === 'public' || (user && exam.createdBy.email === user.email)
    
    if (!canMerge && !selectedExamIds.has(exam.id)) {
      toast.error('You can only merge your own exams or public exams')
      return
    }

    const newSelected = new Set(selectedExamIds)
    const newDetails = [...selectedExamsDetails]
    
    if (newSelected.has(exam.id)) {
      newSelected.delete(exam.id)
      const index = newDetails.findIndex(e => e.id === exam.id)
      if (index > -1) newDetails.splice(index, 1)
    } else {
      newSelected.add(exam.id)
      newDetails.push(exam)
    }
    
    setSelectedExamIds(newSelected)
    setSelectedExamsDetails(newDetails)
  }

  const getBreadcrumbs = (folderId: string | null) => {
    const breadcrumbs = []
    let current = allFolders.find(f => f._id === folderId)
    while (current) {
      breadcrumbs.unshift(current)
      current = allFolders.find(f => f._id === current?.parent)
    }
    return breadcrumbs
  }

  // Folder Tree Component
  const FolderTreeItem = ({ folder, level = 0 }: { folder: Folder, level?: number }) => {
    const hasChildren = !!folderTree[folder._id]?.length
    const isExpanded = expandedFolders.has(folder._id)
    const isSelected = currentFolderId === folder._id

    return (
      <div className="select-none">
        <div 
          className={`flex items-center py-1.5 px-2 cursor-pointer rounded-md transition-colors ${
            isSelected 
              ? 'bg-primary/10 text-primary font-medium' 
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setCurrentFolderId(folder._id)}
        >
          <div 
            className="p-0.5 mr-1 hover:bg-accent/80 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              toggleFolderExpand(folder._id)
            }}
          >
            {hasChildren ? (
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            ) : <span className="w-3.5 h-3.5 block" />}
          </div>
          <FolderIcon className={`h-4 w-4 mr-2 ${isSelected ? 'fill-primary/20' : ''}`} />
          <span className="text-sm truncate flex-1">{folder.name}</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/folders/${folder._id}/settings`)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={() => setFolderToDelete(folder)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {folderTree[folder._id].map(child => (
                <FolderTreeItem key={child._id} folder={child} level={level + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <SEO 
        title="Exams" 
        description="Browse and manage your exams." 
        image="https://res.cloudinary.com/dwvy7icmo/image/upload/v1764256549/cbt-assets/cbt-exam-library.png"
      />
      <div className="flex h-[calc(100vh-64px)] bg-background">
        {/* Sidebar */}
        <div className="w-72 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b bg-background">
            <Button onClick={() => setIsCreateFolderOpen(true)} className="w-full justify-start shadow-sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div 
              className={`flex items-center py-2 px-3 cursor-pointer rounded-md transition-colors ${
                !currentFolderId 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              onClick={() => setCurrentFolderId(null)}
            >
              <div className="w-5 mr-1" />
              <LayoutGrid className="h-4 w-4 mr-2" />
              <span className="text-sm">All Exams</span>
            </div>
            {folderTree['root']?.map(folder => (
              <FolderTreeItem key={folder._id} folder={folder} />
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b bg-background/95 backdrop-blur z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center flex-wrap gap-2">
                  <span 
                    className={`cursor-pointer hover:text-primary transition-colors ${!currentFolderId ? 'text-foreground' : 'text-muted-foreground'}`}
                    onClick={() => setCurrentFolderId(null)}
                  >
                    All Exams
                  </span>
                  {getBreadcrumbs(currentFolderId).map((folder, index, array) => (
                    <React.Fragment key={folder._id}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <span 
                        className={`cursor-pointer hover:text-primary transition-colors ${index === array.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}
                        onClick={() => setCurrentFolderId(folder._id)}
                      >
                        {folder.name}
                      </span>
                    </React.Fragment>
                  ))}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {selectedExamIds.size > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex gap-2"
                  >
                    <Button 
                        onClick={() => {
                            setItemsToMove(Array.from(selectedExamIds).map(id => ({ id, type: 'exam' })))
                            setIsMoveModalOpen(true)
                        }} 
                        variant="outline"
                        size="sm"
                    >
                        <FolderInput className="mr-2 h-4 w-4" />
                        Move ({selectedExamIds.size})
                    </Button>
                    {selectedExamIds.size > 1 && (
                        <Button onClick={() => setIsMergeModalOpen(true)} variant="secondary" size="sm">
                            Merge ({selectedExamIds.size})
                        </Button>
                    )}
                  </motion.div>
                )}
                <Button onClick={() => navigate('/folders/join')} variant="outline" size="sm">
                  <Users className="mr-2 h-4 w-4" />
                  Join Folder
                </Button>
                {isTeacher && (
                  <Button onClick={() => navigate('/exams/create')} size="sm" className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Exam
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-muted/50 border-muted focus:bg-background transition-colors"
                />
              </div>
              <div className="flex items-center border rounded-md p-1 bg-muted/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 ${viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            {/* Subfolders Grid */}
            {currentSubfolders.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center">
                  <FolderOpen className="w-4 h-4 mr-2" /> Folders
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentSubfolders.map(folder => (
                    <motion.div
                      key={folder._id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card 
                        className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary group"
                        onClick={() => setCurrentFolderId(folder._id)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center overflow-hidden">
                            <div className={`p-2 rounded-lg mr-3 ${
                              folder.visibility === 'public' ? 'bg-success/10 text-success' :
                              folder.visibility === 'invited' ? 'bg-brand/10 text-brand' : 'bg-warning/10 text-warning'
                            }`}>
                              <FolderIcon className="h-5 w-5" />
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{folder.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {folder.visibility === 'public' ? 'Public' :
                                 folder.visibility === 'invited' ? 'Invited Only' : 'Private'}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/folders/${folder._id}/settings`)
                              }}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  setItemsToMove([{ id: folder._id, type: 'folder' }])
                                  setIsMoveModalOpen(true)
                              }}>
                                  <FolderInput className="mr-2 h-4 w-4" />
                                  Move
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10" 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setFolderToDelete(folder)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Exams Grid */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center">
                <FileText className="w-4 h-4 mr-2" /> Exams
              </h2>
              {isExamsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-16 bg-background rounded-xl border border-dashed">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No exams found</h3>
                  <p className="text-muted-foreground mt-1">Create a new exam to get started</p>
                  {isTeacher && (
                    <Button variant="outline" className="mt-4" onClick={() => navigate('/exams/create')}>
                      Create Exam
                    </Button>
                  )}
                </div>
              ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
                  <AnimatePresence>
                    {exams.map(exam => (
                      <motion.div
                        key={exam.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card 
                          className={`cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden ${
                            viewMode === 'list' ? 'flex flex-row items-center' : 'flex flex-col'
                          } ${selectedExamIds.has(exam.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                          onClick={() => navigate(`/exams/${exam.id}`)}
                        >
                          {/* Selection Checkbox Overlay */}
                          <div className={`absolute top-3 left-3 z-10 ${viewMode === 'list' ? 'relative top-0 left-0 mr-4' : ''}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`p-0 h-6 w-6 rounded-md ${selectedExamIds.has(exam.id) ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExamSelection(exam)
                              }}
                            >
                              {selectedExamIds.has(exam.id) ? (
                                <CheckSquare className="h-5 w-5" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </Button>
                          </div>

                          <div className={`flex-1 ${viewMode === 'list' ? 'flex items-center justify-between p-4' : ''}`}>
                            <CardHeader className={viewMode === 'list' ? 'p-0 flex-1' : 'pb-2 pt-10'}>
                              <div className="flex justify-between items-start gap-2">
                                <CardTitle className="text-base font-semibold line-clamp-1 group-hover:text-primary transition-colors" title={exam.title}>
                                  {exam.title}
                                </CardTitle>
                                {viewMode === 'grid' && (
                                  <Badge variant={
                                    exam.status === 'published' ? 'default' : 
                                    exam.status === 'draft' ? 'secondary' : 'outline'
                                  } className="shrink-0">
                                    {exam.status}
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="line-clamp-2 h-10 text-xs mt-1">
                                {exam.description || 'No description provided'}
                              </CardDescription>
                            </CardHeader>
                            
                            <CardContent className={viewMode === 'list' ? 'p-0 flex items-center gap-6' : 'pt-2'}>
                              <div className={`flex text-xs text-muted-foreground ${viewMode === 'list' ? 'gap-6' : 'justify-between mb-4'}`}>
                                <span className="flex items-center"><FileText className="w-3 h-3 mr-1" /> {exam.questionCount} Qs</span>
                                <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {exam.settings.duration} min</span>
                                {viewMode === 'list' && (
                                  <span className="flex items-center">{formatRelativeTime(exam.createdAt)}</span>
                                )}
                              </div>
                              
                              {viewMode === 'grid' && (
                                <div className="flex items-center justify-between pt-4 border-t mt-2">
                                  <div className="text-xs text-muted-foreground">
                                    {formatRelativeTime(exam.createdAt)}
                                  </div>
                                  <div className="flex gap-1">
                                    {isTeacher && (
                                      <>
                                        {exam.status !== 'published' && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 w-7 p-0"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  navigate(`/exams/${exam.id}/edit`)
                                                }}
                                              >
                                                <Edit className="h-3.5 w-3.5" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Edit</TooltipContent>
                                          </Tooltip>
                                        )}
                                        
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                              <MoreVertical className="h-3.5 w-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            {exam.status === 'published' ? (
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation()
                                                unpublishExamMutation.mutate(exam.id)
                                              }}>
                                                <Eye className="mr-2 h-4 w-4" /> Unpublish
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem onClick={(e) => {
                                                e.stopPropagation()
                                                publishExamMutation.mutate(exam.id)
                                              }}>
                                                <Eye className="mr-2 h-4 w-4" /> Publish
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation()
                                              navigate(`/exams/${exam.id}/settings`)
                                            }}>
                                              <Settings className="mr-2 h-4 w-4" /> Settings
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setExamToDelete(exam)
                                              }}
                                            >
                                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Folder Modal */}
        <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Create a folder to organize your exams.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Folder Name</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Mathematics 101"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Brief description of folder contents"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>Cancel</Button>
              <Button onClick={() => createFolderMutation.mutate(newFolderName)} disabled={!newFolderName}>
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialogs */}
        <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Folder</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{folderToDelete?.name}"? This action cannot be undone and may affect items inside.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => folderToDelete && deleteFolderMutation.mutate(folderToDelete._id)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!examToDelete} onOpenChange={(open) => !open && setExamToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Exam</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{examToDelete?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExamToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => examToDelete && deleteExamMutation.mutate(examToDelete.id)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Modal */}
        <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Move {itemsToMove.length} Item{itemsToMove.length !== 1 ? 's' : ''}</DialogTitle>
                    <DialogDescription>Select a destination folder</DialogDescription>
                </DialogHeader>
                <div className="max-h-[300px] overflow-y-auto border rounded-md p-2">
                    <div 
                        className={`p-2 cursor-pointer hover:bg-gray-100 rounded flex items-center ${targetFolderId === 'root' ? 'bg-blue-50 text-blue-600' : ''}`}
                        onClick={() => setTargetFolderId('root')}
                    >
                        <LayoutGrid className="mr-2 h-4 w-4" /> Root (All Exams)
                    </div>
                    {allFolders.map(f => (
                        <div 
                            key={f._id}
                            className={`p-2 cursor-pointer hover:bg-gray-100 rounded flex items-center ${targetFolderId === f._id ? 'bg-blue-50 text-blue-600' : ''}`}
                            style={{ marginLeft: f.parent ? '20px' : '0px' }} // Simple indentation
                            onClick={() => setTargetFolderId(f._id)}
                        >
                            <FolderIcon className="mr-2 h-4 w-4" /> {f.name}
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsMoveModalOpen(false)}>Cancel</Button>
                    <Button onClick={() => moveItemsMutation.mutate()} disabled={!targetFolderId}>Move</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  )
}

export default ExamsPage

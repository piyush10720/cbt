import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  ChevronDown, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit,
  Eye,
  ArrowLeft,
  CheckSquare,
  Square,
  Settings,
  Lock,
  Users,
  Globe,
  Copy
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
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import InvitedUsersList from '@/components/InvitedUsersList'

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
  
  // Modals
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderVisibility, setNewFolderVisibility] = useState<'owner' | 'invited' | 'public'>('owner')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [isFolderSettingsOpen, setIsFolderSettingsOpen] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [localFolderSettings, setLocalFolderSettings] = useState<Partial<Folder>>({})
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [mergeConfig, setMergeConfig] = useState({
    title: '',
    description: '',
    duration: 60,
    randomizeQuestions: false
  })
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null)

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
      folderId: currentFolderId || 'root'
    }).then(res => res.data),
    { keepPreviousData: true }
  )

  // Derived Data
  const allFolders = allFoldersData || []
  const currentSubfolders = allFolders.filter(f => f.parent === currentFolderId)
  const exams = examsData?.exams || []
  
  // Initialize local folder settings when modal opens
  useEffect(() => {
    if (isFolderSettingsOpen && selectedFolder) {
      setLocalFolderSettings({
        visibility: selectedFolder.visibility,
        inviteCode: selectedFolder.inviteCode,
        inviteLink: selectedFolder.inviteLink,
        description: selectedFolder.description
      })
    }
  }, [isFolderSettingsOpen, selectedFolder])

  // Debounce timer for description updates
  const descriptionTimerRef = useRef<any>(null)

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

  const mergeExamsMutation = useMutation(
    async () => {
      await examAPI.mergeExams({
        examIds: Array.from(selectedExamIds),
        title: mergeConfig.title,
        description: mergeConfig.description,
        settings: {
          duration: mergeConfig.duration,
          randomizeQuestions: mergeConfig.randomizeQuestions,
          totalMarks: 0 // Backend calculates this
        }
      })
    },
    {
      onSuccess: () => {
        toast.success('Exams merged successfully')
        setIsMergeModalOpen(false)
        setSelectedExamIds(new Set())
        setSelectedExamsDetails([])
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to merge exams')
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
    // Check if exam is mergeable (owner or public)
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

  // Calculate merged totals
  const mergedTotals = useMemo(() => {
    return selectedExamsDetails.reduce((acc, exam) => ({
      marks: acc.marks + (exam.settings.totalMarks || 0),
      duration: acc.duration + (exam.settings.duration || 0),
      questions: acc.questions + (exam.questionCount || 0)
    }), { marks: 0, duration: 0, questions: 0 })
  }, [selectedExamsDetails])

  // Folder Tree Component
  const FolderTreeItem = ({ folder, level = 0 }: { folder: Folder, level?: number }) => {
    const hasChildren = !!folderTree[folder._id]?.length
    const isExpanded = expandedFolders.has(folder._id)
    const isSelected = currentFolderId === folder._id

    return (
      <div>
        <div 
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 rounded-md ${isSelected ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => setCurrentFolderId(folder._id)}
          onContextMenu={(e) => {
            e.preventDefault()
            // Custom context menu logic could go here
          }}
        >
          <div 
            className="p-1 mr-1 hover:bg-gray-200 rounded"
            onClick={(e) => {
              e.stopPropagation()
              toggleFolderExpand(folder._id)
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : <span className="w-3 h-3 block" />}
          </div>
          <FolderIcon className="h-4 w-4 mr-2" />
          <span className="text-sm truncate">{folder.name}</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setSelectedFolder(folder)
                setIsFolderSettingsOpen(true)
              }}>
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
        {isExpanded && hasChildren && (
          <div>
            {folderTree[folder._id].map(child => (
              <FolderTreeItem key={child._id} folder={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-64 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <Button onClick={() => setIsCreateFolderOpen(true)} className="w-full justify-start" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div 
            className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 rounded-md mb-1 ${!currentFolderId ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
            onClick={() => setCurrentFolderId(null)}
          >
            <div className="w-5 mr-1" />
            <FolderIcon className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">All Exams</span>
          </div>
          {folderTree['root']?.map(folder => (
            <FolderTreeItem key={folder._id} folder={folder} />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                {currentFolderId ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentFolderId(null)}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <span className="mx-2">/</span>
                    {allFolders.find(f => f._id === currentFolderId)?.name}
                  </>
                ) : 'All Exams'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedExamIds.size > 1 && (
                <Button onClick={() => setIsMergeModalOpen(true)} variant="secondary">
                  Merge ({selectedExamIds.size})
                </Button>
              )}
              <Button onClick={() => navigate('/folders/join')} variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Join Folder
              </Button>
              {isTeacher && (
                <Button onClick={() => navigate('/exams/create')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Exam
                </Button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 max-w-md"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {/* Subfolders Grid */}
          {currentSubfolders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Folders</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {currentSubfolders.map(folder => (
                  <Card 
                    key={folder._id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setCurrentFolderId(folder._id)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center overflow-hidden">
                        <FolderIcon className={`h-8 w-8 mr-3 flex-shrink-0 ${
                          folder.visibility === 'public' ? 'text-green-500' :
                          folder.visibility === 'invited' ? 'text-blue-500' : 'text-yellow-500'
                        }`} />
                        <div className="truncate">
                          <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                          <p className="text-xs text-gray-500">
                            {folder.visibility === 'public' ? 'Public' :
                             folder.visibility === 'invited' ? 'Invited Only' : 'Private'}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFolder(folder)
                            setIsFolderSettingsOpen(true)
                          }}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600" 
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
                ))}
              </div>
            </div>
          )}

          {/* Exams Grid */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Exams</h2>
            {isExamsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900">No exams found</h3>
                <p className="text-gray-500 mt-1">Create a new exam to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map(exam => (
                  <Card key={exam.id} className="hover:shadow-md transition-shadow relative group">
                    <div className="absolute top-3 left-3 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExamSelection(exam)
                        }}
                      >
                        {selectedExamIds.has(exam.id) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </Button>
                    </div>
                    <CardHeader className="pb-2 pt-10">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold line-clamp-1" title={exam.title}>
                          {exam.title}
                        </CardTitle>
                        <Badge variant={
                          exam.status === 'published' ? 'default' : 
                          exam.status === 'draft' ? 'secondary' : 'outline'
                        }>
                          {exam.status}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 h-10">
                        {exam.description || 'No description provided'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm text-gray-500 mb-4">
                        <span>{exam.questionCount} Questions</span>
                        <span>{exam.settings.duration} mins</span>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-xs text-gray-400">
                          {formatRelativeTime(exam.createdAt)}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/exams/${exam.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isTeacher && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/exams/${exam.id}/edit`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setExamToDelete(exam)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
              <Label>Visibility</Label>
              <Select 
                value={newFolderVisibility} 
                onValueChange={(value: any) => setNewFolderVisibility(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center">
                      <Lock className="mr-2 h-4 w-4" />
                      <span>Private (Owner Only)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="invited">
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      <span>Invited Users Only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div className="flex items-center">
                      <Globe className="mr-2 h-4 w-4" />
                      <span>Public (Everyone)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Brief description of folder contents..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createFolderMutation.mutate(newFolderName)}
              disabled={!newFolderName.trim() || createFolderMutation.isLoading}
            >
              {createFolderMutation.isLoading ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Settings Modal */}
      <Dialog open={isFolderSettingsOpen} onOpenChange={setIsFolderSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Folder Settings: {selectedFolder?.name}</DialogTitle>
            <DialogDescription>
              Manage visibility, access, and invite settings.
            </DialogDescription>
          </DialogHeader>
          
          {selectedFolder && (
            <div className="space-y-6 py-4">
              {/* Visibility Settings */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Visibility</Label>
                <Select 
                  value={localFolderSettings.visibility || selectedFolder.visibility} 
                  onValueChange={(value: any) => {
                    // Optimistic update
                    setLocalFolderSettings(prev => ({ ...prev, visibility: value }))
                    
                    // API Call
                    folderAPI.updateFolder(selectedFolder._id, { visibility: value })
                      .then(() => {
                        queryClient.invalidateQueries(['folders'])
                        toast.success('Visibility updated')
                      })
                      .catch(() => {
                        // Revert on error
                        setLocalFolderSettings(prev => ({ ...prev, visibility: selectedFolder.visibility }))
                        toast.error('Failed to update visibility')
                      })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">
                      <div className="flex items-center">
                        <Lock className="mr-2 h-4 w-4" />
                        <span className="font-medium">Private</span>
                        <span className="ml-2 text-gray-500 text-xs">- Only you can access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="invited">
                      <div className="flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        <span className="font-medium">Invited Users</span>
                        <span className="ml-2 text-gray-500 text-xs">- Only invited users can access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex items-center">
                        <Globe className="mr-2 h-4 w-4" />
                        <span className="font-medium">Public</span>
                        <span className="ml-2 text-gray-500 text-xs">- Anyone can access</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Invite System - Only show if visibility is 'invited' */}
              {(localFolderSettings.visibility || selectedFolder.visibility) === 'invited' && (
                <>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
                    <h3 className="font-medium text-blue-900 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Invite Users
                    </h3>
                    
                    {/* Invite Code */}
                    <div>
                      <Label className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1 block">Invite Code</Label>
                      <div className="flex gap-2">
                        {selectedFolder.inviteCode ? (
                          <>
                            <div className="flex-1 bg-white border rounded px-3 py-2 font-mono text-lg tracking-widest text-center select-all">
                              {selectedFolder.inviteCode}
                            </div>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedFolder.inviteCode!)
                                toast.success('Code copied!')
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => {
                                folderAPI.revokeInvite(selectedFolder._id, 'code').then(() => {
                                  queryClient.invalidateQueries(['folders'])
                                  toast.success('Code revoked')
                                })
                              }}
                            >
                              Revoke
                            </Button>
                          </>
                        ) : (
                          <Button 
                            className="w-full" 
                            variant="outline"
                            onClick={() => {
                              folderAPI.generateInviteCode(selectedFolder._id).then(() => {
                                queryClient.invalidateQueries(['folders'])
                                toast.success('Code generated')
                              })
                            }}
                          >
                            Generate Invite Code
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Users can join using this code on the Join Folder page.
                      </p>
                    </div>

                    {/* Invite Link */}
                    <div>
                      <Label className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1 block">Invite Link</Label>
                      {selectedFolder.inviteLink ? (
                        <>
                          <div className="flex gap-2">
                            <Input 
                              value={`${window.location.origin}/folders/join/${selectedFolder.inviteLink}`} 
                              readOnly 
                              className="flex-1 bg-white"
                            />
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/folders/join/${selectedFolder.inviteLink}`
                                )
                                toast.success('Link copied!')
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                folderAPI.revokeInvite(selectedFolder._id, 'link').then(() => {
                                  queryClient.invalidateQueries(['folders'])
                                  toast.success('Link revoked')
                                })
                              }}
                            >
                              Revoke
                            </Button>
                          </div>
                          {selectedFolder.inviteLinkExpiry && (
                            <p className="text-xs text-gray-500 mt-1">
                              Expires: {new Date(selectedFolder.inviteLinkExpiry).toLocaleDateString()}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <Select onValueChange={(val) => {
                            const days = val === 'never' ? 'never' : parseInt(val)
                            folderAPI.generateInviteLink(selectedFolder._id, days).then(() => {
                              queryClient.invalidateQueries(['folders'])
                              toast.success('Link generated')
                            })
                          }}>
                            <SelectTrigger className="w-[180px] bg-white">
                              <SelectValue placeholder="Generate Link..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Expires in 1 day</SelectItem>
                              <SelectItem value="7">Expires in 7 days</SelectItem>
                              <SelectItem value="30">Expires in 30 days</SelectItem>
                              <SelectItem value="never">Never expires</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Invited Users List - Show for invited folders */}
              {(localFolderSettings.visibility || selectedFolder.visibility) === 'invited' && selectedFolder && (
                <InvitedUsersList folderId={selectedFolder._id} userIds={selectedFolder.allowedUsers || []} />
              )}

              {/* Description */}
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea 
                  value={localFolderSettings.description !== undefined ? localFolderSettings.description : (selectedFolder.description || '')}
                  onChange={(e) => {
                    const val = e.target.value
                    setLocalFolderSettings(prev => ({ ...prev, description: val }))
                    
                    // Debounce API call
                    if (descriptionTimerRef.current) clearTimeout(descriptionTimerRef.current)
                    descriptionTimerRef.current = setTimeout(() => {
                      folderAPI.updateFolder(selectedFolder._id, { description: val })
                        .then(() => queryClient.invalidateQueries(['folders']))
                    }, 500)
                  }}
                  placeholder="Add a description..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Exams Modal */}
      <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Merge Exams</DialogTitle>
            <DialogDescription>
              Combine {selectedExamIds.size} selected exams into a new single exam.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Exam Title</Label>
                <Input
                  value={mergeConfig.title}
                  onChange={(e) => setMergeConfig(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Combined Final Exam"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={mergeConfig.description}
                  onChange={(e) => setMergeConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description for the merged exam..."
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={mergeConfig.duration}
                  onChange={(e) => setMergeConfig(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-gray-500">
                  Sum of selected exams: {mergedTotals.duration} mins
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <CheckSquare 
                  className={`h-5 w-5 cursor-pointer ${mergeConfig.randomizeQuestions ? 'text-blue-600' : 'text-gray-300'}`}
                  onClick={() => setMergeConfig(prev => ({ ...prev, randomizeQuestions: !prev.randomizeQuestions }))}
                />
                <Label onClick={() => setMergeConfig(prev => ({ ...prev, randomizeQuestions: !prev.randomizeQuestions }))}>
                  Randomize Questions
                </Label>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="font-medium mb-3">Selected Exams</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedExamsDetails.map(exam => (
                  <div key={exam.id} className="text-sm p-2 bg-white rounded border flex justify-between">
                    <span className="truncate flex-1 mr-2" title={exam.title}>{exam.title}</span>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {exam.questionCount} Qs / {exam.settings.totalMarks} Pts
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t space-y-1 text-sm">
                <div className="flex justify-between font-medium">
                  <span>Total Questions:</span>
                  <span>{mergedTotals.questions}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total Marks:</span>
                  <span>{mergedTotals.marks}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => mergeExamsMutation.mutate()}
              disabled={!mergeConfig.title || mergeExamsMutation.isLoading}
            >
              {mergeExamsMutation.isLoading ? 'Merging...' : 'Create Merged Exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={!!folderToDelete} onOpenChange={(open: boolean) => !open && setFolderToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{folderToDelete?.name}"? This action cannot be undone.
              Any exams inside will be moved to the parent folder or root.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => folderToDelete && deleteFolderMutation.mutate(folderToDelete._id)}
              disabled={deleteFolderMutation.isLoading}
            >
              {deleteFolderMutation.isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Exam Dialog */}
      <Dialog open={!!examToDelete} onOpenChange={(open: boolean) => !open && setExamToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{examToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => examToDelete && deleteExamMutation.mutate(examToDelete.id)}
              disabled={deleteExamMutation.isLoading}
            >
              {deleteExamMutation.isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ExamsPage

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { bookmarkAPI, Bookmark, BookmarkFolder } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import { 
  BookmarkCheck, 
  Search, 
  FolderOpen, 
  FileText, 
  LayoutGrid,
  List,
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import QuestionCard from '@/components/QuestionCard'

const BookmarksPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Fetch folders
  const {
    data: foldersData,
    isLoading: foldersLoading
  } = useQuery<{ folders: BookmarkFolder[] }>(
    'bookmark-folders',
    async () => {
      const response = await bookmarkAPI.getBookmarkFolders()
      return response.data
    },
    {
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to load folders'
        toast.error(message)
      }
    }
  )

  // Fetch bookmarks
  const {
    data: bookmarksData,
    isLoading: bookmarksLoading
  } = useQuery<{ bookmarks: Bookmark[]; count: number }>(
    ['bookmarks', selectedFolder, searchQuery],
    async () => {
      const params: any = {}
      if (selectedFolder !== 'all') {
        params.examId = selectedFolder
      }
      if (searchQuery) {
        params.search = searchQuery
      }
      params.sortBy = 'createdAt'
      params.order = 'desc'

      const response = await bookmarkAPI.getBookmarks(params)
      return response.data
    },
    {
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to load bookmarks'
        toast.error(message)
      }
    }
  )

  // Delete bookmark mutation
  const deleteBookmarkMutation = useMutation(
    async (bookmarkId: string) => {
      return bookmarkAPI.deleteBookmark(bookmarkId)
    },
    {
      onSuccess: () => {
        toast.success('Bookmark deleted successfully')
        queryClient.invalidateQueries('bookmarks')
        queryClient.invalidateQueries('bookmark-folders')
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to delete bookmark'
        toast.error(message)
      }
    }
  )

  // Update bookmark mutation
  const updateBookmarkMutation = useMutation(
    async ({ id, notes }: { id: string; notes: string }) => {
      return bookmarkAPI.updateBookmark(id, { notes })
    },
    {
      onSuccess: () => {
        toast.success('Note updated successfully')
        queryClient.invalidateQueries('bookmarks')
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || 'Failed to update note'
        toast.error(message)
      }
    }
  )

  const folders = foldersData?.folders || []
  const bookmarks = bookmarksData?.bookmarks || []

  const handleDeleteBookmark = (bookmarkId: string) => {
    if (window.confirm('Are you sure you want to delete this bookmark?')) {
      deleteBookmarkMutation.mutate(bookmarkId)
    }
  }

  const handleUpdateNote = (bookmarkId: string, notes: string) => {
    updateBookmarkMutation.mutate({ id: bookmarkId, notes })
  }

  const isLoading = foldersLoading || bookmarksLoading

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Hero Header */}
      <div className="relative bg-gray-900 text-white overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-purple-900/90 z-0" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 z-0" />
        
        <div className="relative z-10 w-full px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <BookmarkCheck className="h-8 w-8 text-blue-400" />
                My Bookmarks
              </h1>
              <p className="text-white/70 max-w-xl">
                Review and manage your saved questions for focused study sessions.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 p-1 rounded-lg backdrop-blur-sm">
              <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-white text-primary' : 'text-white hover:bg-white/20'}
              >
                <LayoutGrid className="h-4 w-4 mr-2" /> Grid
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-white text-primary' : 'text-white hover:bg-white/20'}
              >
                <List className="h-4 w-4 mr-2" /> List
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Folders */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  Folders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {isLoading && !folders.length ? (
                  <div className="py-8 text-center">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedFolder('all')}
                      className={`w-full text-left px-3 py-2.5 rounded-md transition-all flex items-center justify-between ${
                        selectedFolder === 'all'
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <LayoutGrid className="h-4 w-4" />
                        <span className="text-sm">All Bookmarks</span>
                      </div>
                      <Badge variant="secondary" className="bg-background/50">{bookmarksData?.count || 0}</Badge>
                    </button>
                    
                    <div className="my-2 border-t border-border/50" />
                    
                    {folders.map((folder) => (
                      <button
                        key={folder._id}
                        onClick={() => setSelectedFolder(folder._id)}
                        className={`w-full text-left px-3 py-2.5 rounded-md transition-all flex items-center justify-between ${
                          selectedFolder === folder._id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{folder.examTitle}</span>
                        </div>
                        <Badge variant="secondary" className="bg-background/50 ml-2">{folder.count}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Bookmarks */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search bookmarks by question text, exam name, notes, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-background shadow-sm border-muted focus:border-primary transition-all"
              />
            </div>

            {/* Bookmarks List */}
            {isLoading ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookmarkCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">
                  {searchQuery ? 'No bookmarks found' : 'No bookmarks yet'}
                </h3>
                <p className="text-muted-foreground mt-1 mb-6">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Start bookmarking questions from your exam results'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => navigate('/results')}>
                    View Results
                  </Button>
                )}
              </div>
            ) : (
              <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className={viewMode === 'grid' ? "grid md:grid-cols-2 gap-4" : "space-y-4"}
              >
                {bookmarks.map((bookmark) => {
                  const isCorrect = bookmark.isCorrect
                  
                  // Construct question object for QuestionCard
                  // Accessing properties from the populated questionId object
                  const question = bookmark.questionId
                  const questionData = {
                    id: question?._id || question?.id || bookmark._id,
                    text: bookmark.questionText || question?.text,
                    type: bookmark.questionType || question?.type,
                    options: question?.options || [],
                    imageUrl: question?.diagram?.url,
                    marks: question?.marks || 1,
                    tags: bookmark.tags || question?.tags || [],
                    explanation: question?.explanation
                  }

                  return (
                    <motion.div variants={item} key={bookmark._id} className="h-full">
                      <div className="relative h-full flex flex-col">
                        <div className="absolute top-3 right-12 z-10" title={bookmark.examTitle}>
                          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm max-w-[150px] truncate">
                            {bookmark.examTitle}
                          </Badge>
                        </div>
                        
                        <QuestionCard
                          question={questionData}
                          userAnswer={bookmark.userAnswer}
                          correctAnswer={bookmark.correctAnswer}
                          isCorrect={isCorrect}
                          isBookmarked={true}
                          onToggleBookmark={() => handleDeleteBookmark(bookmark._id)}
                          marksAwarded={bookmark.marksAwarded}
                          showCorrectAnswer={true}
                          showUserAnswer={true}
                          showExplanation={!!question?.explanation}
                          showTags={true}
                          note={bookmark.notes}
                          onNoteChange={(note) => handleUpdateNote(bookmark._id, note)}
                          isNoteEnabled={true}
                        />
                        
                        <div className="mt-2 flex justify-end px-1">
                           <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 text-xs text-muted-foreground hover:text-primary"
                              onClick={() => navigate(`/results/${bookmark.resultId}`)}
                            >
                              View Full Result <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookmarksPage

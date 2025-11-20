import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { bookmarkAPI, Bookmark, BookmarkFolder } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSpinner from '@/components/LoadingSpinner'
import { 
  BookmarkCheck, 
  Search, 
  FolderOpen, 
  Trash2, 
  FileText, 
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  ChevronRight,
  Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate, getPerformanceColor } from '@/lib/utils'

// Helper function to highlight matched text
const highlightText = (text: string, query: string) => {
  if (!query.trim()) return text

  const parts = text.split(new RegExp(`(${query})`, 'gi'))
  
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 text-gray-900 font-medium px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  )
}

const BookmarksPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

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
    isLoading: bookmarksLoading,
    refetch: refetchBookmarks
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

  const folders = foldersData?.folders || []
  const bookmarks = bookmarksData?.bookmarks || []

  const handleDeleteBookmark = (bookmarkId: string) => {
    if (window.confirm('Are you sure you want to delete this bookmark?')) {
      deleteBookmarkMutation.mutate(bookmarkId)
    }
  }

  const renderAnswer = (answer: any, shouldHighlight: boolean = false) => {
    if (!answer || answer === null || answer === undefined || answer === '') {
      return <span className="text-gray-400 italic">No answer</span>
    }

    let answerText = ''
    if (Array.isArray(answer)) {
      answerText = answer.join(', ')
    } else if (typeof answer === 'boolean') {
      answerText = answer ? 'True' : 'False'
    } else {
      answerText = String(answer)
    }

    if (shouldHighlight && searchQuery) {
      return highlightText(answerText, searchQuery)
    }

    return answerText
  }

  const isLoading = foldersLoading || bookmarksLoading

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BookmarkCheck className="h-8 w-8 text-blue-600" />
          My Bookmarks
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Save and organize questions for later review
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar - Folders */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Folders
              </CardTitle>
              <CardDescription>Browse by exam</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {isLoading ? (
                <div className="py-8 text-center">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                <>
                  {folders.map((folder) => (
                    <button
                      key={folder._id}
                      onClick={() => setSelectedFolder(folder._id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedFolder === folder._id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {folder._id === 'all' ? (
                            <FileText className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="text-sm truncate">{folder.examTitle}</span>
                        </div>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                          {folder.count}
                        </span>
                      </div>
                    </button>
                  ))}
                  {folders.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No bookmarks yet
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Bookmarks */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search bookmarks by question text, exam name, notes, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bookmarks List */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : bookmarks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookmarkCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {searchQuery ? 'No bookmarks found' : 'No bookmarks yet'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Start bookmarking questions from your exam results'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => navigate('/results')}>
                    View Results
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookmarks.map((bookmark) => {
                const isCorrect = bookmark.isCorrect
                const hasAnswer = bookmark.userAnswer !== null && 
                                 bookmark.userAnswer !== undefined && 
                                 bookmark.userAnswer !== ''

                return (
                  <Card
                    key={bookmark._id}
                    className={`${
                      !hasAnswer
                        ? 'border-slate-200'
                        : isCorrect
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-red-200 bg-red-50/30'
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">
                              {searchQuery ? highlightText(bookmark.examTitle, searchQuery) : bookmark.examTitle}
                            </CardTitle>
                            <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded ${
                              !hasAnswer
                                ? 'bg-gray-100 text-gray-600'
                                : isCorrect
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {!hasAnswer
                                ? 'Unanswered'
                                : isCorrect
                                ? 'Correct'
                                : 'Incorrect'}
                            </span>
                          </div>
                          <CardDescription className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3" />
                            Bookmarked {formatDate(bookmark.createdAt)}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBookmark(bookmark._id)}
                          disabled={deleteBookmarkMutation.isLoading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Question Text */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Question:</p>
                        <p className="text-sm text-gray-600 whitespace-pre-line">
                          {searchQuery ? highlightText(bookmark.questionText, searchQuery) : bookmark.questionText}
                        </p>
                      </div>

                      {/* Answers */}
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div className="bg-white/50 rounded-lg border border-gray-200 p-3">
                          <p className="text-xs uppercase text-gray-500 mb-1 flex items-center gap-1">
                            {isCorrect ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                            Your answer
                          </p>
                          <p className="text-gray-800 font-medium">
                            {renderAnswer(bookmark.userAnswer, true)}
                          </p>
                        </div>
                        <div className="bg-white/50 rounded-lg border border-gray-200 p-3">
                          <p className="text-xs uppercase text-gray-500 mb-1">Correct answer</p>
                          <p className="text-gray-800 font-medium">
                            {bookmark.correctAnswer && bookmark.correctAnswer.length > 0
                              ? searchQuery 
                                ? highlightText(bookmark.correctAnswer.join(', '), searchQuery)
                                : bookmark.correctAnswer.join(', ')
                              : 'Not available'}
                          </p>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 border-t border-gray-200 pt-3">
                        <span className="flex items-center gap-1">
                          <Award className="h-4 w-4 text-blue-600" />
                          Marks: {bookmark.marksAwarded}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-purple-600" />
                          Type: {bookmark.questionType.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 border-t border-gray-200 pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/results/${bookmark.resultId}`)}
                        >
                          View Full Result
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarksPage


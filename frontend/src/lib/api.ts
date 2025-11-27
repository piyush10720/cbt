import axios, { AxiosResponse } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 12000000), // 20 minutes default
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cbt_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cbt_token')
      localStorage.removeItem('cbt_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Types
export interface User {
  _id?: string
  id: string
  name: string
  email: string
  role: 'student' | 'teacher' | 'admin'
  profile?: {
    avatar?: string
    bio?: string
    institution?: string
    phone?: string
  }
  examHistory?: any[]
  stats?: {
    totalExams: number
    averageScore: number
    bestScore: number
    recentActivity: any[]
  }
  createdAt: string
  lastLogin?: string
}

export interface QuestionDiagram {
  present: boolean
  page?: number
  page_width?: number
  page_height?: number
  bounding_box?: {
    x: number
    y: number
    width: number
    height: number
  }
  description?: string
  url?: string
  uploaded_at?: string
  upload_error?: string
}

export interface QuestionOption {
  label: string
  text: string
  diagram?: QuestionDiagram
}

// Question interface with support for negative marking schemes
export interface Question {
  _id?: string
  id: string
  type: 'mcq_single' | 'mcq_multi' | 'true_false' | 'numeric' | 'descriptive'
  text: string
  options: (string | QuestionOption)[] // Support both old string format and new object format
  correct: string[]
  marks: number
  negative_marks: number
  negative_marking_scheme?: '1/4' | '1/3' | '1/2' | 'custom' | 'none' // Fraction of positive marks
  difficulty?: 'easy' | 'medium' | 'hard'
  subject?: string
  topic?: string
  tags?: string[]
  explanation?: string
  order?: number
  diagram?: QuestionDiagram
  sourcePageNumber?: number
}

export interface Explanation {
  overview: string
  why_user_answer: string
  why_correct_answer: string
  tips: string[]
}

export interface Exam {
  id: string
  title: string
  description?: string
  createdBy: User
  questions: Question[]
  questionCount?: number
  settings: {
    duration: number
    totalMarks: number
    passingMarks?: number
    negativeMarking: boolean
    randomizeQuestions: boolean
    randomizeOptions: boolean
    showResultImmediately: boolean
    allowReview: boolean
    preventTabSwitch: boolean
    webcamMonitoring: boolean
    maxAttempts: number
    allowCalculator: boolean
    allowPracticeMode: boolean
  }
  schedule: {
    startDate: string
    endDate: string
    timezone: string
  }
  access: {
    type: 'owner' | 'invited' | 'public'
    allowedUsers?: string[]
    accessCode?: string
    requireApproval?: boolean
    inviteCode?: string
    inviteLink?: string
    inviteLinkExpiry?: string
  }
  status: 'draft' | 'published' | 'active' | 'completed' | 'archived'
  isPublished: boolean
  publishedAt?: string
  createdAt: string
  isActive?: boolean
  statistics?: any
  folders?: string[]
  originalFiles?: {
    questionPaper?: { url: string; path: string }
    answerKey?: { url: string; path: string }
  }
}

export interface Folder {
  _id: string
  name: string
  parent: string | null
  createdBy: string
  visibility: 'owner' | 'invited' | 'public'
  allowedUsers?: string[]
  description?: string
  inviteCode?: string
  inviteLink?: string
  inviteLinkExpiry?: string
  createdAt: string
  updatedAt: string
}

export interface Result {
  id: string
  user: User
  exam: Exam
  attemptNumber: number
  answers: Array<{
    questionId: string
    questionText?: string
    questionType?: string
    questionOptions?: string[]
    userAnswer: any
    correctAnswer?: string[]
    isCorrect?: boolean
    marksAwarded: number
    timeSpent: number
    isMarkedForReview: boolean
    explanation?: Explanation
  }>
  score: number
  totalMarks: number
  percentage: number
  status: 'started' | 'in_progress' | 'completed' | 'submitted' | 'auto_submitted' | 'abandoned'
  timing: {
    startedAt: string
    submittedAt?: string
    totalTimeSpent: number
    timeRemaining?: number
  }
  analytics: {
    correctAnswers: number
    incorrectAnswers: number
    unanswered: number
    markedForReview: number
    averageTimePerQuestion: number
  }
  feedback?: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
    overallComment: string
  }
  createdAt: string
}

export interface Bookmark {
  _id: string
  userId: string
  questionId: Question
  examId: Exam
  examTitle: string
  resultId: string
  questionText: string
  questionType: string
  userAnswer: any
  correctAnswer: string[]
  isCorrect: boolean
  marksAwarded: number
  notes?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export interface BookmarkFolder {
  _id: string
  examTitle: string
  count: number
  lastBookmarked: string
}

// Auth API
export const authAPI = {
  register: (data: {
    name: string
    email: string
    password: string
    role?: string
  }): Promise<AxiosResponse<{ user: User; token: string; message: string }>> =>
    api.post('/auth/register', data),

  login: (data: {
    email: string
    password: string
  }): Promise<AxiosResponse<{ user: User; token: string; message: string }>> =>
    api.post('/auth/login', data),

  getProfile: (): Promise<AxiosResponse<{ user: User }>> =>
    api.get('/auth/profile'),

  updateProfile: (data: {
    name?: string
    profile?: any
  }): Promise<AxiosResponse<{ user: User; message: string }>> =>
    api.put('/auth/profile', data),

  changePassword: (data: {
    currentPassword: string
    newPassword: string
  }): Promise<AxiosResponse<{ message: string }>> =>
    api.put('/auth/change-password', data),

  logout: (): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/logout'),
}

// Exam API
export const examAPI = {
  getExams: (params?: {
    page?: number
    limit?: number
    status?: string
    createdBy?: string
    search?: string
    sortBy?: string
    sortOrder?: string
    folderId?: string
  }): Promise<AxiosResponse<{ 
    exams: Exam[]; 
    pagination: any;
    stats?: {
      totalPublished: number;
      totalDrafts: number;
    }
  }>> =>
    api.get('/exam', { params }),

  getExamById: (
    id: string,
    includeQuestions = false
  ): Promise<AxiosResponse<{ exam: Exam }>> =>
    api.get(`/exam/${id}`, { params: { includeQuestions } }),

  createExam: (data: {
    title: string
    description?: string
    settings: any
    schedule: any
    access?: any
    questions: Question[]
  }): Promise<AxiosResponse<{ exam: Exam; message: string }>> =>
    api.post('/exam', data),

  updateExam: (
    id: string,
    data: any
  ): Promise<AxiosResponse<{ exam: Exam; message: string }>> =>
    api.put(`/exam/${id}`, data),

  publishExam: (
    id: string
  ): Promise<AxiosResponse<{ exam: Exam; message: string }>> =>
    api.post(`/exam/${id}/publish`),

  unpublishExam: (
    id: string
  ): Promise<AxiosResponse<{ exam: Exam; message: string }>> =>
    api.post(`/exam/${id}/unpublish`),

  deleteExam: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/exam/${id}`),

  startExam: (
    id: string,
    mode?: 'practice' | 'exam'
  ): Promise<AxiosResponse<{ data: { resultId: string; exam: Exam; attempt: any }; message: string }>> =>
    api.post(`/exam/${id}/start`, { mode }),

  mergeExams: (data: {
    examIds: string[]
    title?: string
    description?: string
    settings?: any
    schedule?: any
    access?: any
  }): Promise<AxiosResponse<{ exam: Exam; message: string }>> =>
    api.post('/exam/merge', data),

  // Invite system
  generateInviteCode: (id: string): Promise<AxiosResponse<{ message: string; inviteCode: string }>> =>
    api.post(`/exam/${id}/invite-code`),

  revokeInviteCode: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/exam/${id}/invite-code`),

  generateInviteLink: (id: string): Promise<AxiosResponse<{ message: string; inviteLink: string; expiry: string }>> =>
    api.post(`/exam/${id}/invite-link`),

  revokeInviteLink: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/exam/${id}/invite-link`),

  addUserToExam: (id: string, userId: string): Promise<AxiosResponse<{ message: string; exam: Exam }>> =>
    api.post(`/exam/${id}/users/add`, { userId }),

  removeUserFromExam: (id: string, userId: string): Promise<AxiosResponse<{ message: string; exam: Exam }>> =>
    api.post(`/exam/${id}/users/remove`, { userId }),
}

// Folder API
export const folderAPI = {
  createFolder: (data: {
    name: string
    parent?: string | null
    visibility?: 'owner' | 'invited' | 'public'
    allowedUsers?: string[]
    description?: string
  }): Promise<AxiosResponse<Folder>> =>
    api.post('/folders', data),

  getFolders: (parentId?: string): Promise<AxiosResponse<Folder[]>> =>
    api.get('/folders', { params: { parentId } }),

  getFolder: (id: string): Promise<AxiosResponse<Folder>> =>
    api.get(`/folders/${id}`),

  updateFolder: (
    id: string,
    data: {
      name?: string
      parent?: string | null
      visibility?: 'owner' | 'invited' | 'public'
      allowedUsers?: string[]
      description?: string
    }
  ): Promise<AxiosResponse<Folder>> =>
    api.put(`/folders/${id}`, data),

  deleteFolder: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/folders/${id}`),

  addExamToFolder: (
    examId: string,
    folderId: string
  ): Promise<AxiosResponse<Exam>> =>
    api.post('/folders/add-exam', { examId, folderId }),

  removeExamFromFolder: (
    examId: string,
    folderId: string
  ): Promise<AxiosResponse<Exam>> =>
    api.post('/folders/remove-exam', { examId, folderId }),

  // Invite system methods
  generateInviteCode: (folderId: string): Promise<AxiosResponse<{ code: string }>> =>
    api.post('/folders/invite/code', { folderId }),

  generateInviteLink: (
    folderId: string,
    expiryDays?: number | 'never'
  ): Promise<AxiosResponse<{ link: string; expiresAt?: string }>> =>
    api.post('/folders/invite/link', { folderId, expiryDays }),

  joinFolderByCode: (inviteCode: string): Promise<AxiosResponse<{ folder: Folder; message: string }>> =>
    api.post('/folders/join/code', { inviteCode }),

  joinFolderByLink: (token: string): Promise<AxiosResponse<{ folder: Folder; message: string }>> =>
    api.get(`/folders/join/${token}`),

  revokeInvite: (
    folderId: string,
    type: 'code' | 'link'
  ): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/folders/invite/revoke', { folderId, type }),

  addUserToFolder: (
    folderId: string,
    userId: string
  ): Promise<AxiosResponse<{ folder: Folder; message: string }>> =>
    api.post('/folders/users/add', { folderId, userId }),

  removeUserFromFolder: (
    folderId: string,
    userId: string
  ): Promise<AxiosResponse<{ folder: Folder; message: string }>> =>
    api.post('/folders/users/remove', { folderId, userId }),
}

// Upload API
export const uploadAPI = {
  uploadQuestionPaper: (file: File): Promise<AxiosResponse<{
    data: { questions: Question[]; totalQuestions: number; extractedText: string; metadata: any }
    message: string
  }>> => {
    const formData = new FormData()
    formData.append('questionPaper', file)
    return api.post('/upload/question-paper', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadAnswerKey: (file: File, questions?: Question[]): Promise<AxiosResponse<{
    data: { questions: Question[]; alignedCount: number; extractedText: string; metadata: any }
    message: string
  }>> => {
    const formData = new FormData()
    formData.append('answerKey', file)
    if (questions) {
      formData.append('questions', JSON.stringify(questions))
    }
    return api.post('/upload/answer-key', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadCompleteExam: (
    questionPaper: File,
    answerKey?: File
  ): Promise<AxiosResponse<{
    data: { 
      questions: Question[]; 
      totalQuestions: number; 
      extractedText: any; 
      metadata: any;
      pdfUrls?: {
        questionPaper: string;
        answerKey?: string;
      }
    }
    message: string
  }>> => {
    const formData = new FormData()
    formData.append('questionPaper', questionPaper)
    if (answerKey) {
      formData.append('answerKey', answerKey)
    }
    return api.post('/upload/complete-exam', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  testGemini: (): Promise<AxiosResponse<{ success: boolean; response?: string; error?: string }>> =>
    api.get('/upload/test-gemini'),
}

// Image Upload API
export const imageUploadAPI = {
  uploadDiagram: (
    file: File,
    metadata: {
      type: 'question' | 'option'
      questionId: string
      optionLabel?: string
    }
  ): Promise<AxiosResponse<{
    data: { url: string; type: string; questionId: string; optionLabel?: string }
    message: string
  }>> => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('type', metadata.type)
    formData.append('questionId', metadata.questionId)
    if (metadata.optionLabel) {
      formData.append('optionLabel', metadata.optionLabel)
    }
    return api.post('/image-upload/diagram', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadDiagramBase64: (
    base64Data: string,
    metadata: {
      type: 'question' | 'option'
      questionId: string
      optionLabel?: string
    }
  ): Promise<AxiosResponse<{
    data: { url: string; type: string; questionId: string; optionLabel?: string }
    message: string
  }>> => {
    return api.post('/image-upload/diagram-base64', {
      base64Data,
      ...metadata
    })
  },
}

// Result API
export const resultAPI = {
  submitAnswer: (
    resultId: string,
    data: {
      questionId: string
      userAnswer: any
      timeSpent?: number
      isMarkedForReview?: boolean
    }
  ): Promise<AxiosResponse<{ data: any; message: string }>> =>
    api.post(`/result/${resultId}/answer`, data),

  getExamProgress: (
    resultId: string
  ): Promise<AxiosResponse<{ result: Result }>> =>
    api.get(`/result/${resultId}/progress`),

  submitExam: (
    resultId: string,
    isAutoSubmit = false
  ): Promise<AxiosResponse<{ result: Result; message: string }>> =>
    api.post(`/result/${resultId}/submit`, { isAutoSubmit }),

  explainAnswer: (
    resultId: string,
    questionId: string
  ): Promise<AxiosResponse<{ success: boolean; explanation: Explanation }>> =>
    api.post(`/result/${resultId}/explain`, { questionId }),

  getResult: (
    resultId: string,
    includeAnswers = false
  ): Promise<AxiosResponse<{ result: Result }>> =>
    api.get(`/result/${resultId}`, { params: { includeAnswers } }),

  getUserResults: (params?: {
    page?: number
    limit?: number
    examId?: string
    status?: string
    search?: string
    sortBy?: string
    sortOrder?: string
  }): Promise<AxiosResponse<{ results: Result[]; pagination: any }>> =>
    api.get('/result', { params }),

  getExamResults: (
    examId: string,
    params?: {
      page?: number
      limit?: number
      status?: string
      sortBy?: string
      sortOrder?: string
    }
  ): Promise<AxiosResponse<{ 
    results: Array<{
      id: string
      user: User
      attemptNumber: number
      score: number
      totalMarks: number
      percentage: number
      status: string
      timing: any
      analytics: any
      cheatingFlags?: any[]
      createdAt: string
    }>
    pagination: any
    aggregateAnalytics: {
      totalAttempts: number
      completedAttempts: number
      averageScore: string
      highestScore: number
      lowestScore: number
      examTitle: string
      totalMarks: number
    }
  }>> =>
    api.get(`/result/exam/${examId}/attempts`, { params }),

  addCheatingFlag: (
    resultId: string,
    data: { type: string; details?: string }
  ): Promise<AxiosResponse<{ message: string; flag: any }>> =>
    api.post(`/result/${resultId}/cheating-flag`, data),

  gradeResult: (
    resultId: string,
    data: { questionId: string; marksAwarded: number }
  ): Promise<AxiosResponse<{ message: string; result: any }>> =>
    api.put(`/result/${resultId}/grade`, data),
}

// Bookmark API
export const bookmarkAPI = {
  toggleBookmark: (data: {
    questionId: string
    resultId: string
  }): Promise<AxiosResponse<{ message: string; bookmarked: boolean; bookmark?: Bookmark }>> =>
    api.post('/bookmarks/toggle', data),

  getBookmarks: (params?: {
    examId?: string
    search?: string
    sortBy?: string
    order?: string
  }): Promise<AxiosResponse<{ bookmarks: Bookmark[]; count: number }>> =>
    api.get('/bookmarks', { params }),

  getBookmarkFolders: (): Promise<AxiosResponse<{ folders: BookmarkFolder[] }>> =>
    api.get('/bookmarks/folders'),

  getBookmark: (id: string): Promise<AxiosResponse<{ bookmark: Bookmark }>> =>
    api.get(`/bookmarks/${id}`),

  updateBookmark: (
    id: string,
    data: { notes?: string; tags?: string[] }
  ): Promise<AxiosResponse<{ message: string; bookmark: Bookmark }>> =>
    api.put(`/bookmarks/${id}`, data),

  deleteBookmark: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/bookmarks/${id}`),

  checkBookmarks: (resultId: string): Promise<AxiosResponse<{ bookmarkedQuestions: string[] }>> =>
    api.get(`/bookmarks/check/${resultId}`),
}

// User API
export const userAPI = {
  getUsersByIds: (userIds: string[]): Promise<AxiosResponse<{ users: any[] }>> =>
    api.post('/auth/users/details', { userIds }),
}

export default api

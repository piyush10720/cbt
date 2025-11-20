import axios, { AxiosResponse } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 1200000), // 20 minutes default
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

export interface Question {
  _id?: string
  id: string
  type: 'mcq_single' | 'mcq_multi' | 'true_false' | 'numeric' | 'descriptive'
  text: string
  options: (string | QuestionOption)[] // Support both old string format and new object format
  correct: string[]
  marks: number
  negative_marks: number
  difficulty?: 'easy' | 'medium' | 'hard'
  subject?: string
  topic?: string
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
  }
  schedule: {
    startDate: string
    endDate: string
    timezone: string
  }
  access: {
    type: 'public' | 'private' | 'restricted'
    allowedUsers?: string[]
    accessCode?: string
    requireApproval: boolean
  }
  status: 'draft' | 'published' | 'active' | 'completed' | 'archived'
  isPublished: boolean
  publishedAt?: string
  createdAt: string
  isActive?: boolean
  statistics?: any
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
  }): Promise<AxiosResponse<{ exams: Exam[]; pagination: any }>> =>
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
    id: string
  ): Promise<AxiosResponse<{ data: { resultId: string; exam: Exam; attempt: any }; message: string }>> =>
    api.post(`/exam/${id}/start`),
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

  addCheatingFlag: (
    resultId: string,
    data: { type: string; details?: string }
  ): Promise<AxiosResponse<{ message: string; flag: any }>> =>
    api.post(`/result/${resultId}/cheating-flag`, data),
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

export default api

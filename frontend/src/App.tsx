import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/ThemeProvider'

// Pages
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import ExamsPage from '@/pages/ExamsPage'
import CreateExamPage from '@/pages/CreateExamPage'
import EditExamPage from '@/pages/EditExamPage'
import ExamDetailsPage from '@/pages/ExamDetailsPage'
import TakeExamPage from '@/pages/TakeExamPage'
import ResultsPage from '@/pages/ResultsPage'
import ResultDetailsPage from '@/pages/ResultDetailsPage'
import BookmarksPage from '@/pages/BookmarksPage'
import ProfilePage from '@/pages/ProfilePage'
import JoinFolderPage from '@/pages/JoinFolderPage'
import JoinFolderByLinkPage from '@/pages/JoinFolderByLinkPage'
import FolderSettingsPage from '@/pages/FolderSettingsPage'
import ExamSettingsPage from '@/pages/ExamSettingsPage'
import LandingPage from '@/pages/LandingPage'

// Components
import Layout from '@/components/Layout'
import LoadingSpinner from '@/components/LoadingSpinner'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Protected Route Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode
  allowedRoles?: string[]
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route
          path="exams/create"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <CreateExamPage />
            </ProtectedRoute>
          }
        />
        <Route path="exams/:id" element={<ExamDetailsPage />} />
        <Route
          path="exams/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <EditExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="exams/:id/settings"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <ExamSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="exams/:id/take" element={<TakeExamPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="results/:id" element={<ResultDetailsPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="folders/join" element={<JoinFolderPage />} />
        <Route path="folders/join/:inviteLink" element={<JoinFolderByLinkPage />} />
        <Route
          path="folders/:folderId/settings"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <FolderSettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// Main App Component
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <Router>
            <div className="App">
              <AppRoutes />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#4ade80',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                  
                }}
              />
            </div>
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App

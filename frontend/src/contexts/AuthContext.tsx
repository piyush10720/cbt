import React, { createContext, useContext, useEffect, useState } from 'react'
import { authAPI, User } from '@/lib/api'
import toast from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string, role?: string) => Promise<boolean>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  isAuthenticated: boolean
  isTeacher: boolean
  isStudent: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('cbt_token')
      const storedUser = localStorage.getItem('cbt_user')

      if (token && storedUser) {
        try {
          // Verify token is still valid by fetching profile
          const response = await authAPI.getProfile()
          setUser(response.data.user)
        } catch (error) {
          // Token is invalid, clear storage
          localStorage.removeItem('cbt_token')
          localStorage.removeItem('cbt_user')
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true)
      const response = await authAPI.login({ email, password })
      const { user: userData, token } = response.data

      // Store token and user data
      localStorage.setItem('cbt_token', token)
      localStorage.setItem('cbt_user', JSON.stringify(userData))
      setUser(userData)

      toast.success('Login successful!')
      return true
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const register = async (
    name: string,
    email: string,
    password: string,
    role = 'student'
  ): Promise<boolean> => {
    try {
      setLoading(true)
      const response = await authAPI.register({ name, email, password, role })
      const { user: userData, token } = response.data

      // Store token and user data
      localStorage.setItem('cbt_token', token)
      localStorage.setItem('cbt_user', JSON.stringify(userData))
      setUser(userData)

      toast.success('Registration successful!')
      return true
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    // Call logout API (optional, for tracking)
    authAPI.logout().catch(() => {
      // Ignore errors, we're logging out anyway
    })

    // Clear local storage
    localStorage.removeItem('cbt_token')
    localStorage.removeItem('cbt_user')
    setUser(null)

    toast.success('Logged out successfully')
  }

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem('cbt_user', JSON.stringify(updatedUser))
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
    isAdmin: user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Higher-order component for protected routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: string[]
) => {
  return (props: P) => {
    const { user, loading } = useAuth()

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading-spinner w-8 h-8"></div>
        </div>
      )
    }

    if (!user) {
      window.location.href = '/login'
      return null
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

    return <Component {...props} />
  }
}

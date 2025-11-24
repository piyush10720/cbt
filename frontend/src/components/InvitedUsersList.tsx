import React from 'react'
import { useQuery, useQueryClient } from 'react-query'
import { userAPI, folderAPI } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Users, Mail, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '@/components/LoadingSpinner'

interface InvitedUsersListProps {
  folderId: string
  userIds: string[]
}

interface UserDetails {
  _id: string
  name: string
  email: string
  profilePicture?: string
  createdAt: string
}

const InvitedUsersList: React.FC<InvitedUsersListProps> = ({ folderId, userIds }) => {
  const queryClient = useQueryClient()

  // Fetch user details
  const { data: usersData, isLoading } = useQuery(
    ['invited-users', userIds],
    async () => {
      if (userIds.length === 0) return { users: [] }
      const response = await userAPI.getUsersByIds(userIds)
      return response.data
    },
    {
      enabled: userIds.length > 0,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  )

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (window.confirm(`Remove ${userName} from this folder?`)) {
      try {
        await folderAPI.removeUserFromFolder(folderId, userId)
        queryClient.invalidateQueries(['folders'])
        queryClient.invalidateQueries(['invited-users'])
        toast.success(`${userName} removed from folder`)
      } catch (error) {
        toast.error('Failed to remove user')
      }
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  return (
    <div>
      <Label className="text-sm font-medium">
        Invited Users ({userIds.length})
      </Label>
      
      <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : usersData?.users && usersData.users.length > 0 ? (
          usersData.users.map((user: UserDetails) => (
            <div key={user._id} className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Profile Picture or Initials */}
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(user.name)}
                  </div>
                )}
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <Calendar className="h-3 w-3" />
                      {formatJoinDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Remove Button */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRemoveUser(user._id, user.name)}
                className="ml-2 flex-shrink-0"
              >
                Remove
              </Button>
            </div>
          ))
        ) : userIds.length > 0 ? (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
            <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">Loading user details...</p>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
            <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">No users invited yet</p>
            <p className="text-xs mt-1">Share the invite code or link to add users</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvitedUsersList

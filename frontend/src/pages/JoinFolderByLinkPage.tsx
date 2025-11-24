import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from 'react-query'
import { folderAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'
import LoadingSpinner from '@/components/LoadingSpinner'

const JoinFolderByLinkPage: React.FC = () => {
  const { inviteLink } = useParams<{ inviteLink: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const joinByLinkMutation = useMutation(
    async () => {
      if (!inviteLink) throw new Error('No invite link provided')
      await folderAPI.joinFolderByLink(inviteLink)
    },
    {
      onSuccess: () => {
        toast.success('Successfully joined folder!')
        queryClient.invalidateQueries(['folders'])
        navigate('/exams')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Invalid or expired invite link')
        setTimeout(() => navigate('/exams'), 2000)
      }
    }
  )

  useEffect(() => {
    if (inviteLink) {
      joinByLinkMutation.mutate()
    }
  }, [inviteLink])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Joining Folder...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">
            {joinByLinkMutation.isLoading ? 'Processing invite link...' : 
             joinByLinkMutation.isError ? 'Failed to join folder' : 
             'Redirecting...'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default JoinFolderByLinkPage

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from 'react-query'
import { folderAPI } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import LoadingSpinner from '@/components/LoadingSpinner'

const JoinFolderPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [inviteCode, setInviteCode] = useState('')

  const joinByCodeMutation = useMutation(
    async () => {
      await folderAPI.joinFolderByCode(inviteCode)
    },
    {
      onSuccess: () => {
        toast.success('Successfully joined folder!')
        queryClient.invalidateQueries(['folders'])
        navigate('/exams')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to join folder')
      }
    }
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Folder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="inviteCode">Invite Code</Label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-8 character code"
              maxLength={8}
              className="mt-2 uppercase"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the invite code shared by the folder owner
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/exams')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => joinByCodeMutation.mutate()}
              disabled={inviteCode.length < 6 || joinByCodeMutation.isLoading}
              className="flex-1"
            >
              {joinByCodeMutation.isLoading && <LoadingSpinner size="sm" className="mr-2" />}
              Join Folder
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Or use an invite link shared by the folder owner
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default JoinFolderPage

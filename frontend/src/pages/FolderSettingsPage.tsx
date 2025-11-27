import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { folderAPI, Folder } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import LoadingSpinner from '@/components/LoadingSpinner'
import Breadcrumbs from '@/components/Breadcrumbs'
import InvitedUsersList from '@/components/InvitedUsersList'
import { Lock, Users, Globe, Copy, Save, ArrowLeft, Trash2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const FolderSettingsPage: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'owner' | 'invited' | 'public'>('owner')
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Reset initial load state when folderId changes
  useEffect(() => {
    setInitialLoadDone(false)
  }, [folderId])

  const { data: folderData, isLoading } = useQuery(
    ['folder', folderId],
    () => folderAPI.getFolder(folderId!),
    {
      enabled: !!folderId,
      onError: () => {
        toast.error('Failed to load folder settings')
        navigate('/exams')
      }
    }
  )

  const folder = folderData?.data

  // Initialize state only when folder data is first loaded
  useEffect(() => {
    if (folder && !initialLoadDone) {
      setName(folder.name)
      setDescription(folder.description || '')
      setVisibility(folder.visibility)
      setInitialLoadDone(true)
    }
  }, [folder, initialLoadDone])

  // Derived isDirty
  const isDirty = useMemo(() => {
    if (!folder) return false
    return (
      name !== folder.name || 
      description !== (folder.description || '') || 
      visibility !== folder.visibility
    )
  }, [folder, name, description, visibility])

  const updateFolderMutation = useMutation(
    async (data: Partial<Folder>) => {
      return await folderAPI.updateFolder(folderId!, data)
    },
    {
      onSuccess: (data) => {
        toast.success('Folder settings updated')
        // Update local state with server response to ensure sync
        const updatedFolder = data.data
        setName(updatedFolder.name)
        setDescription(updatedFolder.description || '')
        setVisibility(updatedFolder.visibility)
        
        queryClient.invalidateQueries(['folder', folderId])
        queryClient.invalidateQueries(['folders'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update folder')
      }
    }
  )

  const deleteFolderMutation = useMutation(
    async () => {
      await folderAPI.deleteFolder(folderId!)
    },
    {
      onSuccess: () => {
        toast.success('Folder deleted')
        queryClient.invalidateQueries(['folders'])
        navigate('/exams')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete folder')
      }
    }
  )

  const handleSave = () => {
    updateFolderMutation.mutate({
      name,
      description,
      visibility
    })
  }

  // Invite Actions Wrappers
  const handleInviteAction = async (action: string, callback: () => Promise<any>) => {
    setInviteActionLoading(action)
    try {
      await callback()
      queryClient.invalidateQueries(['folder', folderId])
      toast.success('Updated successfully')
    } catch (error) {
      toast.error('Action failed')
    } finally {
      setInviteActionLoading(null)
    }
  }

  if (isLoading || !folder) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const showInviteSection = visibility === 'invited'
  const isInviteSectionDisabled = showInviteSection && folder.visibility !== 'invited'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[
        { label: 'Exams', href: '/exams' },
        { label: folder.name, href: `/exams?folder=${folder._id}` },
        { label: 'Settings' }
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Folder Settings</h1>
          <p className="text-muted-foreground mt-1">Manage settings for {folder.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium mr-2">
              Unsaved changes
            </span>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!isDirty || updateFolderMutation.isLoading}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateFolderMutation.isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/exams')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Exams
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>Basic details about your folder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Folder Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder="Folder Description"
                className="bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* Visibility & Access */}
        <Card>
          <CardHeader>
            <CardTitle>Visibility & Access</CardTitle>
            <CardDescription>Control who can see and access this folder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Visibility Mode</Label>
              <Select 
                value={visibility} 
                onValueChange={(value: any) => setVisibility(value)}
              >
                <SelectTrigger>
                  <SelectValue />
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



            {showInviteSection && (
              <div className={`p-4 bg-brand/10 rounded-lg border border-brand/20 space-y-4 transition-opacity ${isInviteSectionDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-brand flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    Invite System
                  </h3>
                  {isInviteSectionDisabled && (
                    <span className="text-xs font-medium text-warning flex items-center bg-warning/10 px-2 py-1 rounded border border-warning/20">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Save changes to enable
                    </span>
                  )}
                </div>
                
                {/* Invite Code */}
                <div>
                  <Label className="text-xs font-medium text-brand uppercase tracking-wider mb-1 block">Invite Code</Label>
                  <div className="flex gap-2">
                    {folder.inviteCode ? (
                      <>
                        <div className="flex-1 bg-background border rounded px-3 py-2 font-mono text-lg tracking-widest text-center select-all">
                          {folder.inviteCode}
                        </div>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(folder.inviteCode!)
                            toast.success('Code copied!')
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="destructive"
                          disabled={inviteActionLoading === 'revokeCode'}
                          onClick={() => handleInviteAction('revokeCode', () => folderAPI.revokeInvite(folder._id, 'code'))}
                        >
                          {inviteActionLoading === 'revokeCode' ? <LoadingSpinner size="sm" /> : 'Revoke'}
                        </Button>
                      </>
                    ) : (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        disabled={inviteActionLoading === 'generateCode'}
                        onClick={() => handleInviteAction('generateCode', () => folderAPI.generateInviteCode(folder._id))}
                      >
                        {inviteActionLoading === 'generateCode' ? <LoadingSpinner size="sm" /> : 'Generate Invite Code'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Invite Link */}
                <div>
                  <Label className="text-xs font-medium text-brand uppercase tracking-wider mb-1 block">Invite Link</Label>
                  {folder.inviteLink ? (
                    <>
                      <div className="flex gap-2">
                        <Input 
                          value={`${window.location.origin}/folders/join/${folder.inviteLink}`} 
                          readOnly 
                          className="flex-1 bg-background"
                        />
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/folders/join/${folder.inviteLink}`
                            )
                            toast.success('Link copied!')
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="destructive"
                          size="sm"
                          disabled={inviteActionLoading === 'revokeLink'}
                          onClick={() => handleInviteAction('revokeLink', () => folderAPI.revokeInvite(folder._id, 'link'))}
                        >
                          {inviteActionLoading === 'revokeLink' ? <LoadingSpinner size="sm" /> : 'Revoke'}
                        </Button>
                      </div>
                      {folder.inviteLinkExpiry && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {new Date(folder.inviteLinkExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      disabled={inviteActionLoading === 'generateLink'}
                      onClick={() => handleInviteAction('generateLink', () => folderAPI.generateInviteLink(folder._id))}
                    >
                      {inviteActionLoading === 'generateLink' ? <LoadingSpinner size="sm" /> : 'Generate Invite Link'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Invited Users List */}
            {visibility === 'invited' && (
              <div className={isInviteSectionDisabled ? 'opacity-50 pointer-events-none' : ''}>
                <InvitedUsersList 
                  userIds={folder.allowedUsers || []} 
                  onRemove={async (userId, userName) => {
                    await folderAPI.removeUserFromFolder(folder._id, userId)
                    toast.success(`${userName} removed from folder`)
                    queryClient.invalidateQueries(['folder', folderId])
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this folder? This action cannot be undone.')) {
                  deleteFolderMutation.mutate()
                }
              }}
              disabled={deleteFolderMutation.isLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteFolderMutation.isLoading ? 'Deleting...' : 'Delete Folder'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default FolderSettingsPage

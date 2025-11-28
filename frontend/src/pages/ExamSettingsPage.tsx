import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { examAPI } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
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
import { Lock, Users, Globe, Copy, Save, ArrowLeft, Trash2, AlertCircle, Calendar, Settings, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { Tooltip } from '@/components/ui/tooltip'

const formatDateTimeLocal = (value?: string | Date) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const ExamSettingsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const defaultSettings = {
    duration: 60,
    totalMarks: 100,
    passingMarks: 40,
    randomizeQuestions: false,
    randomizeOptions: false,
    showResultImmediately: true,
    allowReview: true,
    preventTabSwitch: false,
    webcamMonitoring: false,
    maxAttempts: 1,
    allowCalculator: false,
    allowPracticeMode: true
  }

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [settings, setSettings] = useState<any>(defaultSettings)
  const [schedule, setSchedule] = useState<any>({
    startDate: '',
    endDate: '',
    timezone: 'UTC'
  })
  const [access, setAccess] = useState<any>({
    type: 'owner',
    accessCode: '',
  })
  
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Reset initial load state when id changes
  useEffect(() => {
    setInitialLoadDone(false)
  }, [id])

  const { data: examData, isLoading } = useQuery(
    ['exam-settings', id],
    async () => {
      if (!id) throw new Error('Missing exam identifier')
      const response = await examAPI.getExamById(id, true)
      return response.data.exam
    },
    {
      enabled: !!id,
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to load exam details')
        navigate('/exams')
      }
    }
  )

  // Initialize state only when exam data is first loaded
  useEffect(() => {
    if (examData && !initialLoadDone) {
      setTitle(examData.title)
      setDescription(examData.description || '')
      setSettings({ ...defaultSettings, ...examData.settings })
      setSchedule({
        ...examData.schedule,
        startDate: formatDateTimeLocal(examData.schedule?.startDate),
        endDate: formatDateTimeLocal(examData.schedule?.endDate)
      })
      setAccess({
        type: examData.access?.type || 'owner',
        accessCode: examData.access?.accessCode || '',
      })
      setInitialLoadDone(true)
    }
  }, [examData, initialLoadDone])

  // Helper for object comparison
  const isObjectEqual = (obj1: any, obj2: any) => {
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    if (keys1.length !== keys2.length) return false
    for (const key of keys1) {
      if (obj1[key] !== obj2[key]) return false
    }
    return true
  }

  // Derived isDirty
  const isDirty = useMemo(() => {
    if (!examData) return false
    
    if (title !== examData.title) return true
    if (description !== (examData.description || '')) return true

    // Compare Settings
    const originalSettings = { ...defaultSettings, ...examData.settings }
    if (!isObjectEqual(settings, originalSettings)) return true

    // Compare Schedule
    if (schedule.startDate !== formatDateTimeLocal(examData.schedule?.startDate)) return true
    if (schedule.endDate !== formatDateTimeLocal(examData.schedule?.endDate)) return true
    
    // Compare Access (basic fields)
    if (access.type !== examData.access?.type) return true
    if (access.accessCode !== (examData.access?.accessCode || '')) return true

    return false
  }, [examData, title, description, settings, schedule, access])

  const updateExamMutation = useMutation(
    async (data: any) => {
      if (!id) throw new Error('Missing exam identifier')
      return await examAPI.updateExam(id, data)
    },
    {
      onSuccess: (data) => {
        toast.success('Exam settings updated')
        // Update local state with server response
        const updatedExam = data.data.exam
        setTitle(updatedExam.title)
        setDescription(updatedExam.description || '')
        setSettings({ ...defaultSettings, ...updatedExam.settings })
        setSchedule({
          ...updatedExam.schedule,
          startDate: formatDateTimeLocal(updatedExam.schedule?.startDate),
          endDate: formatDateTimeLocal(updatedExam.schedule?.endDate)
        })
        setAccess({
          type: updatedExam.access?.type || 'owner',
          accessCode: updatedExam.access?.accessCode || '',
        })
        
        queryClient.invalidateQueries(['exam-settings', id])
        queryClient.invalidateQueries(['exam', id])
        queryClient.invalidateQueries(['exams'])
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update exam')
      }
    }
  )

  const deleteExamMutation = useMutation(
    async () => {
      if (!id) return
      await examAPI.deleteExam(id)
    },
    {
      onSuccess: () => {
        toast.success('Exam deleted')
        queryClient.invalidateQueries(['exams'])
        navigate('/exams')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete exam')
      }
    }
  )

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Exam title is required')
      return
    }
    updateExamMutation.mutate({
      title,
      description,
      settings,
      schedule,
      access: {
        ...examData?.access,
        ...access
      }
    })
  }

  // Invite Actions Wrappers
  const handleInviteAction = async (action: string, callback: () => Promise<any>) => {
    setInviteActionLoading(action)
    try {
      await callback()
      queryClient.invalidateQueries(['exam-settings', id])
      toast.success('Updated successfully')
    } catch (error) {
      toast.error('Action failed')
    } finally {
      setInviteActionLoading(null)
    }
  }

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  if (isLoading || !examData) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const showInviteSection = access.type === 'invited'
  const isInviteSectionDisabled = showInviteSection && examData.access?.type !== 'invited'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Breadcrumbs items={[
        { label: 'Exams', href: '/exams' },
        { label: examData.title, href: `/exams/${id}` },
        { label: 'Settings' }
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Exam Settings</h1>
          <p className="text-muted-foreground mt-1">Configure settings for {examData.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium mr-2">
              Unsaved changes
            </span>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!isDirty || updateExamMutation.isLoading}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateExamMutation.isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={() => navigate(`/exams/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Exam
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Access</span>
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Basic details about your exam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title</Label>
                <Input 
                  id="title"
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Exam Title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Exam Description"
                  className="min-h-[100px] bg-background"
                />
              </div>
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
                  if (window.confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
                    deleteExamMutation.mutate()
                  }
                }}
                disabled={deleteExamMutation.isLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteExamMutation.isLoading ? 'Deleting...' : 'Delete Exam'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Configuration</CardTitle>
              <CardDescription>Set duration, marks, and behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input 
                    id="duration"
                    type="number" 
                    min="1"
                    value={settings.duration} 
                    onChange={(e) => handleSettingChange('duration', parseInt(e.target.value) || 0)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passingMarks">Passing Marks</Label>
                  <Input 
                    id="passingMarks"
                    type="number" 
                    min="0"
                    value={settings.passingMarks} 
                    onChange={(e) => handleSettingChange('passingMarks', parseInt(e.target.value) || 0)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalMarks">Total Marks</Label>
                  <Input 
                    id="totalMarks"
                    type="number" 
                    min="0"
                    value={settings.totalMarks} 
                    onChange={(e) => handleSettingChange('totalMarks', parseInt(e.target.value) || 0)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Max Attempts</Label>
                  <Input 
                    id="maxAttempts"
                    type="number" 
                    min="1"
                    value={settings.maxAttempts} 
                    onChange={(e) => handleSettingChange('maxAttempts', parseInt(e.target.value) || 1)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="randomizeQuestions" className="flex-1">Randomize Questions</Label>
                  <Switch 
                    id="randomizeQuestions"
                    checked={settings.randomizeQuestions}
                    onCheckedChange={(checked: boolean) => handleSettingChange('randomizeQuestions', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="randomizeOptions" className="flex-1">Randomize Options</Label>
                  <Switch 
                    id="randomizeOptions"
                    checked={settings.randomizeOptions}
                    onCheckedChange={(checked: boolean) => handleSettingChange('randomizeOptions', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="allowPracticeMode" className="flex-1">Allow Practice Mode</Label>
                  <Switch 
                    id="allowPracticeMode"
                    checked={settings.allowPracticeMode}
                    onCheckedChange={(checked: boolean) => handleSettingChange('allowPracticeMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="showResultImmediately" className="flex-1">Show Result Immediately</Label>
                  <Switch 
                    id="showResultImmediately"
                    checked={settings.showResultImmediately}
                    onCheckedChange={(checked: boolean) => handleSettingChange('showResultImmediately', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="preventTabSwitch" className="flex-1">Prevent Tab Switch</Label>
                  <Switch 
                    id="preventTabSwitch"
                    checked={settings.preventTabSwitch}
                    onCheckedChange={(checked: boolean) => handleSettingChange('preventTabSwitch', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="allowReview" className="flex-1">Allow Review</Label>
                  <Switch 
                    id="allowReview"
                    checked={settings.allowReview}
                    onCheckedChange={(checked: boolean) => handleSettingChange('allowReview', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="allowCalculator" className="flex-1">Show Calculator</Label>
                  <Switch 
                    id="allowCalculator"
                    checked={settings.allowCalculator}
                    onCheckedChange={(checked: boolean) => handleSettingChange('allowCalculator', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="webcamMonitoring" className="flex-1">Webcam Monitoring</Label>
                <Tooltip >
                  <Switch 
                    id="webcamMonitoring"
                    checked={settings.webcamMonitoring}
                    disabled
                  />
                </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Set when the exam is available.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date & Time</Label>
                  <div className="relative">
                    <Input 
                      id="startDate"
                      type="datetime-local"
                      value={schedule.startDate}
                      onChange={(e) => setSchedule({ ...schedule, startDate: e.target.value })}
                      className="pl-10"
                    />
                    <div className="absolute left-3 top-2.5 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date & Time</Label>
                  <div className="relative">
                    <Input 
                      id="endDate"
                      type="datetime-local"
                      value={schedule.endDate}
                      onChange={(e) => setSchedule({ ...schedule, endDate: e.target.value })}
                      className="pl-10"
                    />
                    <div className="absolute left-3 top-2.5 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Tab */}
        <TabsContent value="access" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Visibility & Access</CardTitle>
              <CardDescription>Control who can see and access this exam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accessType">Visibility Mode</Label>
                <Select 
                  value={access.type} 
                  onValueChange={(value: any) => setAccess({ ...access, type: value })}
                >
                  <SelectTrigger id="accessType">
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
                <div className={`p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-4 transition-opacity ${isInviteSectionDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Invite System
                    </h3>
                    {isInviteSectionDisabled && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Save changes to enable
                      </span>
                    )}
                  </div>
                  
                  {/* Invite Code */}
                  <div>
                    <Label className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1 block">Invite Code</Label>
                    <div className="flex gap-2">
                      {examData.access?.inviteCode ? (
                        <>
                          <div className="flex-1 bg-background border rounded px-3 py-2 font-mono text-lg tracking-widest text-center select-all">
                            {examData.access.inviteCode}
                          </div>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(examData.access.inviteCode!)
                              toast.success('Code copied!')
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="destructive"
                            disabled={inviteActionLoading === 'revokeCode'}
                            onClick={() => handleInviteAction('revokeCode', () => examAPI.revokeInviteCode(id!))}
                          >
                            {inviteActionLoading === 'revokeCode' ? <LoadingSpinner size="sm" /> : 'Revoke'}
                          </Button>
                        </>
                      ) : (
                        <Button 
                          className="w-full" 
                          variant="outline"
                          disabled={inviteActionLoading === 'generateCode'}
                          onClick={() => handleInviteAction('generateCode', () => examAPI.generateInviteCode(id!))}
                        >
                          {inviteActionLoading === 'generateCode' ? <LoadingSpinner size="sm" /> : 'Generate Invite Code'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Invite Link */}
                  <div>
                    <Label className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1 block">Invite Link</Label>
                    {examData.access?.inviteLink ? (
                      <>
                        <div className="flex gap-2">
                          <Input 
                            value={`${window.location.origin}/exams/join/${examData.access.inviteLink}`} 
                            readOnly 
                            className="flex-1 bg-background"
                          />
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/exams/join/${examData.access.inviteLink}`
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
                            onClick={() => handleInviteAction('revokeLink', () => examAPI.revokeInviteLink(id!))}
                          >
                            {inviteActionLoading === 'revokeLink' ? <LoadingSpinner size="sm" /> : 'Revoke'}
                          </Button>
                        </div>
                        {examData.access.inviteLinkExpiry && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires: {new Date(examData.access.inviteLinkExpiry).toLocaleDateString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        disabled={inviteActionLoading === 'generateLink'}
                        onClick={() => handleInviteAction('generateLink', () => examAPI.generateInviteLink(id!))}
                      >
                        {inviteActionLoading === 'generateLink' ? <LoadingSpinner size="sm" /> : 'Generate Invite Link'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Invited Users List */}
              {access.type === 'invited' && (
                <div className={isInviteSectionDisabled ? 'opacity-50 pointer-events-none' : ''}>
                  <InvitedUsersList 
                    userIds={examData.access?.allowedUsers || []} 
                    onRemove={async (userId, userName) => {
                      await examAPI.removeUserFromExam(id!, userId)
                      toast.success(`${userName} removed from exam`)
                      queryClient.invalidateQueries(['exam-settings', id])
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ExamSettingsPage

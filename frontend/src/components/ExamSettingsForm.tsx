import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Settings, Calendar, Lock, FileText } from 'lucide-react'

interface ExamSettingsFormProps {
  examSettings: any
  onSettingsUpdate: (settings: any) => void
}

const ExamSettingsForm: React.FC<ExamSettingsFormProps> = ({
  examSettings,
  onSettingsUpdate
}) => {
  const handleInputChange = (field: string, value: any) => {
    onSettingsUpdate({
      ...examSettings,
      [field]: value
    })
  }

  const handleSettingsChange = (field: string, value: any) => {
    onSettingsUpdate({
      ...examSettings,
      settings: {
        ...examSettings.settings,
        [field]: value
      }
    })
  }

  const handleAccessChange = (field: string, value: any) => {
    onSettingsUpdate({
      ...examSettings,
      access: {
        ...examSettings.access,
        [field]: value
      }
    })
  }

  return (
    <div className="space-y-6">
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
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Set exam title and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title *</Label>
                <Input
                  id="title"
                  value={examSettings.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter exam title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={examSettings.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter exam description"
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Exam Configuration</CardTitle>
              <CardDescription>Configure duration, marks, and behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={examSettings.settings.duration}
                    onChange={(e) => handleSettingsChange('duration', parseInt(e.target.value) || 0)}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passingMarks">Passing Marks</Label>
                  <Input
                    id="passingMarks"
                    type="number"
                    value={examSettings.settings.passingMarks || ''}
                    onChange={(e) => handleSettingsChange('passingMarks', parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="Optional"
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Maximum Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    min="1"
                    value={examSettings.settings.maxAttempts}
                    onChange={(e) => handleSettingsChange('maxAttempts', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="randomizeQuestions" className="flex-1">Randomize Questions</Label>
                  <Switch
                    id="randomizeQuestions"
                    checked={examSettings.settings.randomizeQuestions}
                    onCheckedChange={(checked) => handleSettingsChange('randomizeQuestions', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="randomizeOptions" className="flex-1">Randomize Options</Label>
                  <Switch
                    id="randomizeOptions"
                    checked={examSettings.settings.randomizeOptions}
                    onCheckedChange={(checked) => handleSettingsChange('randomizeOptions', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="showResultImmediately" className="flex-1">Show Result Immediately</Label>
                  <Switch
                    id="showResultImmediately"
                    checked={examSettings.settings.showResultImmediately}
                    onCheckedChange={(checked) => handleSettingsChange('showResultImmediately', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="preventTabSwitch" className="flex-1">Prevent Tab Switch</Label>
                  <Switch
                    id="preventTabSwitch"
                    checked={examSettings.settings.preventTabSwitch}
                    onCheckedChange={(checked) => handleSettingsChange('preventTabSwitch', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="allowCalculator" className="flex-1">Allow Calculator</Label>
                  <Switch
                    id="allowCalculator"
                    checked={examSettings.settings.allowCalculator}
                    onCheckedChange={(checked) => handleSettingsChange('allowCalculator', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="negativeMarking" className="flex-1">Negative Marking</Label>
                  <Switch
                    id="negativeMarking"
                    checked={examSettings.settings.negativeMarking}
                    onCheckedChange={(checked) => handleSettingsChange('negativeMarking', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="allowReview" className="flex-1">Allow Review</Label>
                  <Switch
                    id="allowReview"
                    checked={examSettings.settings.allowReview}
                    onCheckedChange={(checked) => handleSettingsChange('allowReview', checked)}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                   <div className="flex flex-col">
                      <Label htmlFor="webcamMonitoring">Webcam Monitoring</Label>
                      <span className="text-[10px] text-blue-600 font-medium">Coming Soon</span>
                   </div>
                  <Switch
                    id="webcamMonitoring"
                    checked={examSettings.settings.webcamMonitoring}
                    onCheckedChange={(checked) => handleSettingsChange('webcamMonitoring', checked)}
                    disabled
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="allowPracticeMode" className="flex-1">Allow Practice Mode</Label>
                  <Switch
                    id="allowPracticeMode"
                    checked={examSettings.settings.allowPracticeMode}
                    onCheckedChange={(checked) => handleSettingsChange('allowPracticeMode', checked)}
                  />
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
              <CardDescription>Set exam start and end dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date & Time *</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={examSettings.schedule.startDate}
                    onChange={(e) => handleInputChange('schedule', {
                      ...examSettings.schedule,
                      startDate: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date & Time *</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={examSettings.schedule.endDate}
                    onChange={(e) => handleInputChange('schedule', {
                      ...examSettings.schedule,
                      endDate: e.target.value
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Tab */}
        <TabsContent value="access" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>Control who can attempt this exam</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accessType">Access Type</Label>
                <Select
                  value={examSettings.access?.type || 'private'}
                  onValueChange={(value) => handleAccessChange('type', value)}
                >
                  <SelectTrigger id="accessType">
                    <SelectValue placeholder="Select access type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Private (Only Creator)</SelectItem>
                    <SelectItem value="public">Public (Any Logged-in User)</SelectItem>
                    <SelectItem value="invited">Restricted (Invite Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-4 border-t">
                <div className="space-y-0.5">
                  <Label htmlFor="requireApproval">Require Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    Require manual approval before participation
                  </p>
                </div>
                <Switch
                  id="requireApproval"
                  checked={examSettings.access?.requireApproval || false}
                  onCheckedChange={(checked) => handleAccessChange('requireApproval', checked)}
                />
              </div>

              {examSettings.access?.type === 'restricted' && (
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="accessCode">Access Code (Optional)</Label>
                  <Input
                    id="accessCode"
                    value={examSettings.access?.accessCode || ''}
                    onChange={(e) => handleAccessChange('accessCode', e.target.value)}
                    placeholder="Provide a code participants must enter"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can manage allowed users after creating the exam.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ExamSettingsForm

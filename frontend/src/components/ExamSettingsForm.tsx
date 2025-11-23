import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Set exam title and description</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exam Title *
            </label>
            <Input
              value={examSettings.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter exam title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={examSettings.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter exam description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exam Settings</CardTitle>
          <CardDescription>Configure exam parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes) *
            </label>
            <Input
              type="number"
              value={examSettings.settings.duration}
              onChange={(e) => handleSettingsChange('duration', parseInt(e.target.value))}
              min="1"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={examSettings.settings.randomizeQuestions}
                  onChange={(e) => handleSettingsChange('randomizeQuestions', e.target.checked)}
                />
                <span className="text-sm">Randomize Questions</span>
              </label>
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={examSettings.settings.showResultImmediately}
                  onChange={(e) => handleSettingsChange('showResultImmediately', e.target.checked)}
                />
                <span className="text-sm">Show Result Immediately</span>
              </label>
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={examSettings.settings.preventTabSwitch}
                  onChange={(e) => handleSettingsChange('preventTabSwitch', e.target.checked)}
                />
                <span className="text-sm">Prevent Tab Switch</span>
              </label>
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={examSettings.settings.allowCalculator}
                  onChange={(e) => handleSettingsChange('allowCalculator', e.target.checked)}
                />
                <span className="text-sm">Allow Calculator</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Attempts
              </label>
              <Input
                type="number"
                min="1"
                value={examSettings.settings.maxAttempts}
                onChange={(e) => handleSettingsChange('maxAttempts', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Set exam start and end dates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <Input
                type="datetime-local"
                value={examSettings.schedule.startDate}
                onChange={(e) => handleInputChange('schedule', {
                  ...examSettings.schedule,
                  startDate: e.target.value
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date & Time *
              </label>
              <Input
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

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>Control who can attempt this exam</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Type
            </label>
            <select
              value={examSettings.access?.type || 'private'}
              onChange={(e) => handleAccessChange('type', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="private">Private (only creator)</option>
              <option value="public">Public (any logged-in user)</option>
              <option value="restricted">Restricted (invite only)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={examSettings.access?.requireApproval || false}
                onChange={(e) => handleAccessChange('requireApproval', e.target.checked)}
              />
              <span className="text-sm">Require manual approval before participation</span>
            </label>
          </div>

          {examSettings.access?.type === 'restricted' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Access Code (optional)</label>
              <Input
                value={examSettings.access?.accessCode || ''}
                onChange={(e) => handleAccessChange('accessCode', e.target.value)}
                placeholder="Provide a code participants must enter"
              />
              <p className="text-xs text-gray-500">You can manage allowed users after creating the exam.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExamSettingsForm

import React, { useEffect, useState } from 'react'
import { Question } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import PDFUploadStep from '@/components/PDFUploadStep'
import QuestionEditor from '@/components/QuestionEditor'
import ExamSettingsForm from '@/components/ExamSettingsForm'
import {
  Upload,
  FileText,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ExamWizardProps {
  onComplete: (examData: any) => void
  loading?: boolean
  initialQuestions?: Question[]
  initialExamSettings?: any
  mode?: 'create' | 'edit'
}

const ExamWizard: React.FC<ExamWizardProps> = ({
  onComplete,
  loading = false,
  initialQuestions,
  initialExamSettings,
  mode = 'create'
}) => {
  const [currentStep, setCurrentStep] = useState(mode === 'edit' ? 1 : 0)
  const [questions, setQuestions] = useState<Question[]>(initialQuestions ?? [])
  const [examSettings, setExamSettings] = useState(
    initialExamSettings ?? {
      title: '',
      description: '',
      settings: {
        duration: 60,
        negativeMarking: false,
        randomizeQuestions: false,
        randomizeOptions: false,
        showResultImmediately: true,
        allowReview: true,
        preventTabSwitch: true,
        webcamMonitoring: false,
        maxAttempts: 1
      },
      schedule: {
        startDate: new Date().toISOString().slice(0, 16),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        timezone: 'UTC'
      },
      access: {
        type: 'private',
        requireApproval: false
      }
    }
  )

  useEffect(() => {
    if (initialQuestions) {
      setQuestions(initialQuestions)
    }
  }, [initialQuestions])

  useEffect(() => {
    if (initialExamSettings) {
      setExamSettings(initialExamSettings)
    }
  }, [initialExamSettings])

  const steps = [
    {
      id: 'upload',
      title: 'Upload Files',
      description: 'Upload question paper and answer key',
      icon: Upload,
      component: PDFUploadStep
    },
    {
      id: 'questions',
      title: 'Review Questions',
      description: 'Edit and verify parsed questions',
      icon: FileText,
      component: QuestionEditor
    },
    {
      id: 'settings',
      title: 'Exam Settings',
      description: 'Configure exam parameters',
      icon: Settings,
      component: ExamSettingsForm
    }
  ]

  const handleQuestionsUpdate = (newQuestions: Question[]) => {
    setQuestions(newQuestions)
  }

  const handleSettingsUpdate = (newSettings: any) => {
    setExamSettings(newSettings)
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    if (!examSettings.title.trim()) {
      toast.error('Please enter an exam title')
      return
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question')
      return
    }

    // Calculate total marks
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0)

    const examData = {
      ...examSettings,
      questions,
      settings: {
        ...examSettings.settings,
        totalMarks
      }
    }

    onComplete(examData)
  }

  const canProceed = () => {
    if (mode === 'edit') {
      if (currentStep === 1) {
        return questions.length > 0 && questions.every(q => q.text && q.text.trim())
      }
      if (currentStep === 2) {
        return examSettings.title.trim() && questions.length > 0
      }
      return true
    }

    switch (currentStep) {
      case 0:
        return questions.length > 0
      case 1:
        return questions.length > 0 && questions.every((q) => q.text && q.text.trim())
      case 2:
        return examSettings.title.trim() && questions.length > 0
      default:
        return false
    }
  }

  const CurrentStepComponent = steps[currentStep].component

  const visibleSteps = mode === 'edit' ? steps.slice(1) : steps
  const activeStep = mode === 'edit' ? currentStep - 1 : currentStep

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'edit' ? 'Exam Editing Progress' : 'Exam Creation Progress'}</CardTitle>
          <CardDescription>
            {mode === 'edit'
              ? 'Review and update existing exam details'
              : 'Follow these steps to create your exam'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {visibleSteps.map((step, index) => {
              const Icon = step.icon
              const stepIndex = mode === 'edit' ? index + 1 : index
              const isActive = stepIndex === currentStep
              const isCompleted = stepIndex < currentStep
              const canAccess = stepIndex <= currentStep || isCompleted

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isActive
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : canAccess
                        ? 'border-gray-300 text-gray-500'
                        : 'border-gray-200 text-gray-300'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                  </div>
                  {index < visibleSteps.length - 1 && (
                    <div className="hidden sm:block w-16 h-px bg-gray-300 ml-6" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {React.createElement(steps[currentStep].icon, { className: "w-5 h-5" })}
            <span>{steps[currentStep].title}</span>
          </CardTitle>
          <CardDescription>
            {steps[currentStep].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentStepComponent
            questions={questions}
            onQuestionsUpdate={handleQuestionsUpdate}
            examSettings={examSettings}
            onSettingsUpdate={handleSettingsUpdate}
            mode={mode}
            hideUpload={mode === 'edit'}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious} disabled={currentStep === (mode === 'edit' ? 1 : 0)}>
          Previous
        </Button>

        <div className="flex space-x-2">
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!canProceed() || loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>{mode === 'edit' ? 'Updating Exam...' : 'Creating Exam...'}</span>
                </div>
              ) : mode === 'edit' ? (
                'Save Changes'
              ) : (
                'Create Exam'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {questions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {questions.length} questions loaded successfully
            </span>
          </div>
        </div>
      )}

      {mode === 'create' && currentStep === 0 && questions.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800">
              Upload your PDF files to get started, or create questions manually
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamWizard

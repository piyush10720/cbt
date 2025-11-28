import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examAPI } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Sparkles, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface AIQuestionCreatorProps {
  onAddQuestion: (questions: any[]) => void
}

const AIQuestionCreator: React.FC<AIQuestionCreatorProps> = ({ onAddQuestion }) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    topic: '',
    subject: '',
    grade: '',
    count: 5,
    type: 'mcq_single',
    difficulty: 50,
    specificNeeds: ''
  })

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isValid = () => {
    return (
      formData.topic.trim().length > 0 &&
      formData.subject.trim().length > 0 &&
      formData.grade.trim().length > 0 &&
      formData.count >= 1 &&
      formData.count <= 50
    )
  }

  const handleGenerate = async () => {
    if (!isValid()) {
      toast.error('Please fill in all required fields correctly')
      return
    }

    setLoading(true)
    try {
      const response = await examAPI.generateQuestions({
        topic: formData.topic,
        subject: formData.subject,
        grade: formData.grade,
        count: formData.count,
        type: formData.type,
        difficulty: formData.difficulty,
        specificNeeds: formData.specificNeeds
      })

      if (response.data.questions && response.data.questions.length > 0) {
        onAddQuestion(response.data.questions)
        toast.success(`Successfully generated ${response.data.questions.length} questions!`)
      } else {
        toast.error('No questions were generated. Please try again.')
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      toast.error(error.response?.data?.message || 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyLabel = (val: number) => {
    if (val <= 30) return 'Easy'
    if (val >= 70) return 'Hard'
    return 'Medium'
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Generate Questions with AI
        </CardTitle>
        <CardDescription>
          Provide details about the exam, and AI will generate questions for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic <span className="text-red-500">*</span></Label>
            <Input
              id="topic"
              placeholder="e.g. Solar System"
              value={formData.topic}
              onChange={(e) => handleChange('topic', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
            <Input
              id="subject"
              placeholder="e.g. Science"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="grade">Grade/Level <span className="text-red-500">*</span></Label>
            <Input
              id="grade"
              placeholder="e.g. Grade 5, High School"
              value={formData.grade}
              onChange={(e) => handleChange('grade', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="count">Number of Questions (1-50) <span className="text-red-500">*</span></Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={50}
              value={formData.count}
              onChange={(e) => handleChange('count', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Question Type</Label>
          <Select
            value={formData.type}
            onValueChange={(val) => handleChange('type', val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcq_single">Multiple Choice (Single Correct)</SelectItem>
              <SelectItem value="mcq_multi">Multiple Choice (Multiple Correct)</SelectItem>
              <SelectItem value="true_false">True / False</SelectItem>
              <SelectItem value="numeric">Numeric</SelectItem>
              <SelectItem value="descriptive">Descriptive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <Label>Difficulty Level</Label>
            <span className="text-sm font-medium text-muted-foreground">
              {formData.difficulty} ({getDifficultyLabel(formData.difficulty)})
            </span>
          </div>
          <Slider
            value={[formData.difficulty]}
            onValueChange={(vals: number[]) => handleChange('difficulty', vals[0])}
            min={1}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="specificNeeds">Specific Needs / Instructions (Optional)</Label>
          <Textarea
            id="specificNeeds"
            placeholder="e.g. Focus on planets, include one trick question..."
            value={formData.specificNeeds}
            onChange={(e) => handleChange('specificNeeds', e.target.value)}
            rows={3}
          />
        </div>

        <div className="pt-4">
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={loading || !isValid()}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span>Generating Questions...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Generate Questions</span>
              </div>
            )}
          </Button>
          {!isValid() && (
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>Please fill in all required fields (Topic, Subject, Grade, Count 1-50)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default AIQuestionCreator
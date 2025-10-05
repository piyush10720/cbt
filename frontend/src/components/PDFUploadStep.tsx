import React, { useState, useCallback } from 'react'
import { useMutation } from 'react-query'
import { uploadAPI, Question } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Plus
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PDFUploadStepProps {
  questions: Question[]
  onQuestionsUpdate: (questions: Question[]) => void
  hideUpload?: boolean
}

const PDFUploadStep: React.FC<PDFUploadStepProps> = ({
  questions,
  onQuestionsUpdate,
  hideUpload = false
}) => {
  const [uploadMethod, setUploadMethod] = useState<'complete' | 'separate'>('complete')
  const [files, setFiles] = useState<{
    questionPaper?: File
    answerKey?: File
  }>({})
  const [dragActive, setDragActive] = useState(false)

  // Upload mutations
  const uploadCompleteMutation = useMutation(
    ({ questionPaper, answerKey }: { questionPaper: File; answerKey?: File }) =>
      uploadAPI.uploadCompleteExam(questionPaper, answerKey),
    {
      onSuccess: (response) => {
        onQuestionsUpdate(response.data.data.questions)
        toast.success(`Successfully parsed ${response.data.data.totalQuestions} questions!`)
      },
      onError: (error: any) => {
        const message = error.response?.data?.message || 'Failed to parse PDF files'
        toast.error(message)
      }
    }
  )

  const uploadQuestionPaperMutation = useMutation(uploadAPI.uploadQuestionPaper, {
    onSuccess: (response) => {
      onQuestionsUpdate(response.data.data.questions)
      toast.success(`Successfully parsed ${response.data.data.totalQuestions} questions!`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to parse question paper'
      toast.error(message)
    }
  })

  const uploadAnswerKeyMutation = useMutation(
    ({ file, existingQuestions }: { file: File; existingQuestions: Question[] }) =>
      uploadAPI.uploadAnswerKey(file, existingQuestions),
    {
      onSuccess: (response) => {
        onQuestionsUpdate(response.data.data.questions)
        toast.success(`Successfully aligned ${response.data.data.alignedCount} answers!`)
      },
      onError: (error: any) => {
        const message = error.response?.data?.message || 'Failed to parse answer key'
        toast.error(message)
      }
    }
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, fileType: 'questionPaper' | 'answerKey') => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const pdfFile = droppedFiles.find(file => file.type === 'application/pdf')

    if (pdfFile) {
      setFiles(prev => ({ ...prev, [fileType]: pdfFile }))
    } else {
      toast.error('Please upload a PDF file')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'questionPaper' | 'answerKey') => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setFiles(prev => ({ ...prev, [fileType]: file }))
    } else {
      toast.error('Please select a PDF file')
    }
  }

  const removeFile = (fileType: 'questionPaper' | 'answerKey') => {
    setFiles(prev => ({ ...prev, [fileType]: undefined }))
  }

  const handleUploadComplete = () => {
    if (!files.questionPaper) {
      toast.error('Please select a question paper')
      return
    }

    uploadCompleteMutation.mutate({
      questionPaper: files.questionPaper,
      answerKey: files.answerKey
    })
  }

  const handleUploadQuestionPaper = () => {
    if (!files.questionPaper) {
      toast.error('Please select a question paper')
      return
    }

    uploadQuestionPaperMutation.mutate(files.questionPaper)
  }

  const handleUploadAnswerKey = () => {
    if (!files.answerKey) {
      toast.error('Please select an answer key')
      return
    }

    if (questions.length === 0) {
      toast.error('Please upload question paper first')
      return
    }

    uploadAnswerKeyMutation.mutate({
      file: files.answerKey,
      existingQuestions: questions
    })
  }

  const addManualQuestion = () => {
    const newQuestion: Question = {
      id: `q${questions.length + 1}`,
      type: 'mcq_single',
      text: '',
      options: ['', '', '', ''],
      correct: [],
      marks: 1,
      negative_marks: 0
    }
    onQuestionsUpdate([...questions, newQuestion])
  }

  const isLoading = uploadCompleteMutation.isLoading || 
                   uploadQuestionPaperMutation.isLoading || 
                   uploadAnswerKeyMutation.isLoading

  return (
    <div className="space-y-6">
      {!hideUpload && (
        <Tabs value={uploadMethod} onValueChange={(value) => setUploadMethod(value as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="complete">Upload Both Files</TabsTrigger>
            <TabsTrigger value="separate">Upload Separately</TabsTrigger>
          </TabsList>

          <TabsContent value="complete" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Question Paper & Answer Key</CardTitle>
                <CardDescription>
                  Upload both files together for automatic question parsing and answer alignment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Question Paper Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Paper (Required)
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : files.questionPaper
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, 'questionPaper')}
                  >
                    {files.questionPaper ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{files.questionPaper.name}</p>
                          <p className="text-sm text-green-600">
                            {(files.questionPaper.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('questionPaper')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop your question paper PDF here, or
                        </p>
                        <Button variant="outline" asChild>
                          <label>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileSelect(e, 'questionPaper')}
                              className="hidden"
                            />
                            Browse Files
                          </label>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Answer Key Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Answer Key (Optional)
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : files.answerKey
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, 'answerKey')}
                  >
                    {files.answerKey ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{files.answerKey.name}</p>
                          <p className="text-sm text-green-600">
                            {(files.answerKey.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('answerKey')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop your answer key PDF here, or
                        </p>
                        <Button variant="outline" asChild>
                          <label>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileSelect(e, 'answerKey')}
                              className="hidden"
                            />
                            Browse Files
                          </label>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleUploadComplete}
                  disabled={!files.questionPaper || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Processing PDFs...</span>
                    </div>
                  ) : (
                    'Parse Questions'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="separate" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Question Paper Only */}
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Question Paper</CardTitle>
                  <CardDescription>
                    Upload your question paper to extract questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      files.questionPaper
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, 'questionPaper')}
                  >
                    {files.questionPaper ? (
                      <div className="space-y-2">
                        <FileText className="w-8 h-8 text-green-600 mx-auto" />
                        <p className="font-medium text-green-800">{files.questionPaper.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('questionPaper')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <Button variant="outline" size="sm" asChild>
                          <label>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileSelect(e, 'questionPaper')}
                              className="hidden"
                            />
                            Select PDF
                          </label>
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleUploadQuestionPaper}
                    disabled={!files.questionPaper || isLoading}
                    className="w-full"
                    size="sm"
                  >
                    {uploadQuestionPaperMutation.isLoading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      'Parse Questions'
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Answer Key */}
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Answer Key</CardTitle>
                  <CardDescription>
                    Upload answer key to align with questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      files.answerKey
                        ? 'border-green-500 bg-green-50'
                        : questions.length === 0
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={(e) => handleDrop(e, 'answerKey')}
                  >
                    {files.answerKey ? (
                      <div className="space-y-2">
                        <FileText className="w-8 h-8 text-green-600 mx-auto" />
                        <p className="font-medium text-green-800">{files.answerKey.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('answerKey')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild
                          disabled={questions.length === 0}
                        >
                          <label>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleFileSelect(e, 'answerKey')}
                              className="hidden"
                            />
                            Select PDF
                          </label>
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleUploadAnswerKey}
                    disabled={!files.answerKey || questions.length === 0 || isLoading}
                    className="w-full"
                    size="sm"
                  >
                    {uploadAnswerKeyMutation.isLoading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      'Align Answers'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Manual Question Creation */}
      <Card>
        <CardHeader>
          <CardTitle>Or Create Questions Manually</CardTitle>
          <CardDescription>
            Add questions one by one without uploading PDFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={addManualQuestion}
            variant="outline"
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Question Manually
          </Button>
        </CardContent>
      </Card>

      {/* Status */}
      {questions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {questions.length} questions ready for review
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PDFUploadStep

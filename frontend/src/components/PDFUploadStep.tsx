import React, { useState, useCallback } from 'react'
import { useMutation } from 'react-query'
import { uploadAPI, Question } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LoadingSpinner from '@/components/LoadingSpinner'
import ManualQuestionCreator from '@/components/ManualQuestionCreator'
import {
  Upload,
  FileText,
  CheckCircle,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PDFUploadStepProps {
  questions: Question[]
  onQuestionsUpdate: (questions: Question[]) => void
  onPdfUrlUpdate?: (pdfUrl: string) => void
  hideUpload?: boolean
}

const PDFUploadStep: React.FC<PDFUploadStepProps> = ({
  questions,
  onQuestionsUpdate,
  onPdfUrlUpdate,
  hideUpload = false
}) => {
  const [files, setFiles] = useState<{
    questionPaper?: File
    answerKey?: File
  }>({})
  const [negativeMarkingScheme, setNegativeMarkingScheme] = useState<'none' | '1/4' | '1/3' | '1/2'>('1/4')
  const [creationMethod, setCreationMethod] = useState<'pdf' | 'manual'>('pdf')
  const [dragActive, setDragActive] = useState(false)

  // Upload mutations
  const uploadCompleteMutation = useMutation(
    ({ questionPaper, answerKey }: { questionPaper: File; answerKey?: File }) =>
      uploadAPI.uploadCompleteExam(questionPaper, answerKey),
    {
      onSuccess: (response: any) => {
        // Apply negative marking scheme to all parsed questions
        const parsedQuestions = response.data.data.questions.map((q: any) => {
          const questionWithScheme = { ...q }
          
          if (negativeMarkingScheme !== 'none') {
            questionWithScheme.negative_marking_scheme = negativeMarkingScheme
            
            // Calculate negative marks based on scheme
            const fraction = negativeMarkingScheme === '1/4' ? 0.25
              : negativeMarkingScheme === '1/3' ? 0.333
              : negativeMarkingScheme === '1/2' ? 0.5
              : 0
            
            questionWithScheme.negative_marks = -Math.abs((q.marks || 1) * fraction)
          } else {
            questionWithScheme.negative_marking_scheme = 'none'
            questionWithScheme.negative_marks = 0
          }
          
          return questionWithScheme
        })
        
        onQuestionsUpdate(parsedQuestions)
        
        if (response.data.data.pdfUrls?.questionPaper && onPdfUrlUpdate) {
          const cloudinaryUrl = response.data.data.pdfUrls.questionPaper
          console.log('Received Cloudinary PDF URL:', cloudinaryUrl)
          
          // Try direct Cloudinary URL first - they support CORS for raw files
          // Only use proxy if direct access fails
          onPdfUrlUpdate(cloudinaryUrl)
        }
        toast.success(`Successfully parsed ${response.data.data.totalQuestions} questions with ${negativeMarkingScheme === 'none' ? 'no' : negativeMarkingScheme} negative marking!`)
      },
      onError: (error: any) => {
        const message = error.response?.data?.message || 'Failed to parse PDF files'
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

  const handleAddManualQuestion = (newQuestion: Question) => {
    console.log('Adding manual question:', newQuestion)
    onQuestionsUpdate([...questions, newQuestion])
  }

  const isLoading = uploadCompleteMutation.isLoading

  return (
    <div className="space-y-6">
      {!hideUpload && (
        <>
          {/* Method Selection */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant={creationMethod === 'pdf' ? 'default' : 'outline'}
                  onClick={() => setCreationMethod('pdf')}
                  className="flex-1 h-20"
                >
                  <div className="text-center">
                    <Upload className="h-6 w-6 mx-auto mb-1" />
                    <span className="font-medium">Upload PDF Files</span>
                    <p className="text-xs opacity-80">Auto-extract questions from PDFs</p>
                  </div>
                </Button>
                <Button
                  variant={creationMethod === 'manual' ? 'default' : 'outline'}
                  onClick={() => setCreationMethod('manual')}
                  className="flex-1 h-20"
                >
                  <div className="text-center">
                    <FileText className="h-6 w-6 mx-auto mb-1" />
                    <span className="font-medium">Create Manually</span>
                    <p className="text-xs opacity-80">Build questions from scratch</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {creationMethod === 'pdf' && (
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

              {/* Negative Marking Scheme Selection */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Negative Marking Scheme (for all questions)
                </label>
                <select
                  value={negativeMarkingScheme}
                  onChange={(e) => setNegativeMarkingScheme(e.target.value as any)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">No Negative Marking</option>
                  <option value="1/4">1/4 of Marks (Standard)</option>
                  <option value="1/3">1/3 of Marks</option>
                  <option value="1/2">1/2 of Marks</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  This scheme will be applied to all questions extracted from the PDF. 
                  You can modify individual questions later in the review phase.
                </p>
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
          )}

          {creationMethod === 'manual' && (
            <ManualQuestionCreator onAddQuestion={handleAddManualQuestion} />
          )}
        </>
      )}

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

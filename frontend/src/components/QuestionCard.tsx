import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import MathText from '@/components/MathText'
import ImageWithModal from '@/components/ImageWithModal'
import { 
  CheckCircle2, 
  XCircle, 
  Bookmark, 
  BookmarkCheck, 
  Edit2, 
  Save, 
  X, 
  BookOpen, 
  Tag, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Lightbulb
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getOptionLabel, getOptionText, getOptionDiagramUrl } from '@/utils/questionHelpers'

export interface QuestionCardProps {
  question: {
    id: string
    text: string
    type: string
    options?: any[]
    imageUrl?: string
    diagram?: { url?: string }
    explanation?: string
    tags?: string[]
    marks: number
  }
  userAnswer?: any
  correctAnswer?: string[] // Array of correct option labels or texts
  isCorrect?: boolean
  isBookmarked?: boolean
  onToggleBookmark?: () => void
  
  // Manual Grading
  marksAwarded?: number
  onGradeChange?: (newMarks: number) => void
  isGradingEnabled?: boolean
  
  // Display Controls
  showCorrectAnswer?: boolean
  showUserAnswer?: boolean
  showExplanation?: boolean
  showTags?: boolean

  // AI Explanation
  onExplain?: () => void
  isExplaining?: boolean
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  userAnswer,
  correctAnswer,
  isCorrect,
  isBookmarked,
  onToggleBookmark,
  marksAwarded,
  onGradeChange,
  isGradingEnabled = false,
  showCorrectAnswer = true,
  showUserAnswer = true,
  showExplanation = true,
  showTags = true,
  onExplain,
  isExplaining = false
}) => {
  const [isEditingGrade, setIsEditingGrade] = useState(false)
  const [gradeInput, setGradeInput] = useState(String(marksAwarded || 0))
  const [showTagsExpanded, setShowTagsExpanded] = useState(false)

  const handleSaveGrade = () => {
    const newMarks = parseFloat(gradeInput)
    if (isNaN(newMarks)) return
    
    // Validation: Cannot exceed max marks
    if (newMarks > question.marks) {
      return
    }
    
    if (newMarks < 0) return 

    onGradeChange?.(newMarks)
    setIsEditingGrade(false)
  }

  const getOptionStatus = (option: any, index: number) => {
    const label = getOptionLabel(option) || String.fromCharCode(65 + index)
    const optionText = getOptionText(option)
    
    const isSelected = Array.isArray(userAnswer) 
      ? userAnswer.includes(label) || userAnswer.includes(optionText)
      : userAnswer === label || userAnswer === optionText

    // Check if this option is correct
    const isOptionCorrect = correctAnswer?.some(ans => 
      ans === label || 
      ans === optionText || 
      (typeof option === 'object' && (ans === option.text || ans === option.label))
    ) || (typeof option === 'object' && option.isCorrect)

    return { isSelected, isOptionCorrect }
  }

  const renderOption = (option: any, index: number) => {
    const label = getOptionLabel(option) || String.fromCharCode(65 + index)
    const { isSelected, isOptionCorrect } = getOptionStatus(option, index)
    const optionText = getOptionText(option)
    // Check for image in multiple places to be safe
    const optionImage = getOptionDiagramUrl(option) || (typeof option === 'object' ? (option.image || option.imageUrl) : null)

    let borderColor = 'border-border'
    let bgColor = 'bg-background'
    let icon = null

    if (showCorrectAnswer && isOptionCorrect) {
      borderColor = 'border-green-500'
      bgColor = 'bg-green-50 dark:bg-green-900/20'
      icon = <CheckCircle2 className="w-4 h-4 text-green-600" />
    } else if (showUserAnswer && isSelected && !isOptionCorrect) {
      borderColor = 'border-red-500'
      bgColor = 'bg-red-50 dark:bg-red-900/20'
      icon = <XCircle className="w-4 h-4 text-red-600" />
    } else if (showUserAnswer && isSelected) {
      borderColor = 'border-primary'
      bgColor = 'bg-primary/5'
    }

    return (
      <div 
        key={index}
        className={cn(
          "flex items-start p-3 rounded-lg border transition-all",
          borderColor,
          bgColor
        )}
      >
        <div className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center mr-3 text-xs font-medium",
          showCorrectAnswer && isOptionCorrect ? "bg-green-600 border-green-600 text-white" :
          showUserAnswer && isSelected && !isOptionCorrect ? "bg-red-600 border-red-600 text-white" :
          showUserAnswer && isSelected ? "bg-primary border-primary text-white" :
          "bg-muted border-muted-foreground/30 text-muted-foreground"
        )}>
          {label}
        </div>
        <div className="flex-1 pt-0.5">
          <MathText text={optionText} />
          {optionImage && (
            <div className="mt-2 max-w-[200px]">
              <ImageWithModal src={optionImage} alt={`Option ${label}`} />
            </div>
          )}
        </div>
        {icon && <div className="ml-2 flex-shrink-0">{icon}</div>}
      </div>
    )
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-shadow hover:shadow-md",
      showUserAnswer && isCorrect === true && "border-l-4 border-l-green-500",
      showUserAnswer && isCorrect === false && "border-l-4 border-l-red-500",
      showUserAnswer && isCorrect === undefined && "border-l-4 border-l-gray-300"
    )}>
      <CardHeader className="bg-muted/30 px-6 py-3 border-b flex flex-row justify-between items-center space-y-0">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-background font-mono">
            {question.type.replace(/_/g, ' ').toUpperCase()}
          </Badge>
          <Badge variant="secondary">
            {question.marks} Marks
          </Badge>
          {showTags && question.tags && question.tags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
               {!showTagsExpanded ? (
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                   onClick={() => setShowTagsExpanded(true)}
                 >
                   <Tag className="w-3 h-3 mr-1" /> Show Tags <ChevronDown className="w-3 h-3 ml-1" />
                 </Button>
               ) : (
                 <div className="flex items-center gap-1">
                   {question.tags.map(tag => (
                     <Badge key={tag} variant="outline" className="text-[10px] h-5 px-1.5">
                       {tag}
                     </Badge>
                   ))}
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="h-6 w-6 p-0 ml-1"
                     onClick={() => setShowTagsExpanded(false)}
                   >
                     <ChevronUp className="w-3 h-3" />
                   </Button>
                 </div>
               )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isGradingEnabled && (
            <div className="flex items-center gap-2 mr-2">
              {isEditingGrade ? (
                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-5 duration-200">
                  <div className="relative">
                    <Input
                      type="number"
                      value={gradeInput}
                      onChange={(e) => setGradeInput(e.target.value)}
                      className={cn(
                        "w-20 h-8 text-right pr-2",
                        parseFloat(gradeInput) > question.marks ? "border-red-500 focus-visible:ring-red-500" : ""
                      )}
                      max={question.marks}
                      min={0}
                    />
                    {parseFloat(gradeInput) > question.marks && (
                       <TooltipProvider>
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <AlertCircle className="w-3 h-3 text-red-500 absolute -top-1 -right-1 bg-background rounded-full" />
                           </TooltipTrigger>
                           <TooltipContent>
                             <p>Cannot exceed max marks ({question.marks})</p>
                           </TooltipContent>
                         </Tooltip>
                       </TooltipProvider>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">/ {question.marks}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSaveGrade} disabled={parseFloat(gradeInput) > question.marks}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setIsEditingGrade(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className={cn(
                    "font-bold text-lg",
                    marksAwarded === question.marks ? "text-green-600" : 
                    (marksAwarded || 0) > 0 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {marksAwarded ?? 0}
                  </span>
                  <span className="text-muted-foreground text-sm">/ {question.marks}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setGradeInput(String(marksAwarded || 0))
                      setIsEditingGrade(true)
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {onToggleBookmark && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleBookmark}
                    className={cn(
                      "h-8 w-8 transition-colors",
                      isBookmarked ? "text-blue-500 hover:text-blue-600 hover:bg-blue-50" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Question Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
          <MathText text={question.text} />
          {(question.imageUrl || question.diagram?.url) && (
            <div className="mt-4 max-w-md">
              <ImageWithModal 
                src={question.imageUrl || question.diagram?.url || ''} 
                alt="Question Diagram" 
              />
            </div>
          )}
        </div>

        {/* Options */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-3 max-w-3xl">
            {question.options.map((option, index) => renderOption(option, index))}
          </div>
        )}

        {/* Non-MCQ Answer Display */}
        {(!question.options || question.options.length === 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
             {showUserAnswer && (
               <div className="bg-muted/30 p-4 rounded-lg border">
                 <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Your Answer</h4>
                 <div className="text-sm">
                   {userAnswer ? (
                     <MathText text={String(userAnswer)} />
                   ) : (
                     <span className="text-muted-foreground italic">No answer provided</span>
                   )}
                 </div>
               </div>
             )}
             {showCorrectAnswer && correctAnswer && (
               <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30">
                 <h4 className="text-xs font-semibold uppercase text-green-700 dark:text-green-400 mb-2">Correct Answer</h4>
                 <div className="text-sm text-green-800 dark:text-green-200">
                   {correctAnswer.map((ans, i) => (
                     <div key={i}><MathText text={ans} /></div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        )}

        {/* Explanation */}
        {showExplanation && (
          <>
            {question.explanation ? (
              <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                <h4 className="text-base font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Explanation
                </h4>
                <div className="space-y-4 text-sm">
                  {/* Parse and render formatted explanation */}
                  {question.explanation.split('\n\n').map((section, idx) => {
                    const lines = section.split('\n');
                    const firstLine = lines[0];
                    
                    // Check if it's a section header (starts with **)
                    if (firstLine.startsWith('**') && firstLine.includes(':**')) {
                      const headerMatch = firstLine.match(/\*\*(.+?):\*\*/);
                      const headerText = headerMatch ? headerMatch[1] : '';
                      const content = firstLine.replace(/\*\*.+?\*\*\s*/, '');
                      
                      return (
                        <div key={idx} className="space-y-2">
                          <h5 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                            {headerText === 'Your Answer' && <XCircle className="w-4 h-4 text-red-500" />}
                            {headerText === 'Correct Answer' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {headerText === 'Tips' && <Lightbulb className="w-4 h-4 text-yellow-500" />}
                            {headerText}
                          </h5>
                          {headerText === 'Tips' ? (
                            <ul className="space-y-1 ml-6">
                              {lines.slice(1).map((tip, tipIdx) => (
                                <li key={tipIdx} className="text-blue-700 dark:text-blue-300 list-disc">
                                  <MathText text={tip.replace(/^•\s*/, '')} />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-blue-700 dark:text-blue-300 pl-6">
                              <MathText text={content} />
                            </div>
                          )}
                        </div>
                      );
                    }
                    
                    // Regular paragraph
                    return (
                      <div key={idx} className="text-blue-700 dark:text-blue-300">
                        <MathText text={section} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : onExplain && (
              <div className="mt-6 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onExplain} 
                  disabled={isExplaining}
                  className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  {isExplaining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Generating Explanation...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      Explain Solution
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
        
        {/* Mobile Tags (if not shown in header) */}
        {showTags && question.tags && question.tags.length > 0 && (
          <div className="mt-4 sm:hidden flex flex-wrap gap-2">
            <Tag className="w-3 h-3 text-muted-foreground mt-1" />
            {question.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default QuestionCard

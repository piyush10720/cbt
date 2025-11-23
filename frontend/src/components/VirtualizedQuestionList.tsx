import React, { CSSProperties, useRef, useEffect, useCallback, Suspense } from 'react'
import { Question } from '@/lib/api'
import CollapsibleQuestionCard from '@/components/CollapsibleQuestionCard'

// Use React.lazy to handle react-window module resolution dynamically
// This avoids "does not provide an export" SyntaxErrors at startup
const VirtualList = React.lazy<React.ComponentType<any>>(async () => {
  let module: any;
  
  try {
    // Attempt 1: Default import
    module = await import('react-window');
    
    // Check if the loaded module actually has the component we need
    // If not, throw to trigger the catch block and try CDN
    const hasExports = 
      module.VariableSizeList || 
      module.default?.VariableSizeList || 
      module.default ||
      module.FixedSizeList;
      
    if (!hasExports) {
      console.warn('Local react-window module loaded but seems empty:', module);
      throw new Error('Local module missing exports');
    }
  } catch (e) {
    console.warn('Local react-window load failed, trying CDN fallback...', e);
    try {
      // Attempt 2: CDN fallback (esm.sh)
      // We use a variable or comment to ensure Vite doesn't try to bundle this
      const cdnUrl = 'https://esm.sh/react-window@1.8.10';
      module = await import(/* @vite-ignore */ cdnUrl);
    } catch (e2) {
      console.error('All react-window imports failed', e2);
      // Return error component
      const ErrorComponent = React.forwardRef((props: any, ref) => (
        <div ref={ref as any} className="p-4 text-red-500 border border-red-300 rounded bg-red-50">
          Failed to load react-window. Please check internet connection.
        </div>
      ));
      return { default: ErrorComponent };
    }
  }

  console.log('Loaded react-window module:', module);
  console.log('Keys:', Object.keys(module));

  // Try to find VariableSizeList in various locations
  const Component = 
    module.VariableSizeList || 
    module.default?.VariableSizeList || 
    module.default ||
    module.FixedSizeList || 
    module.default?.FixedSizeList;
    
  if (!Component) {
    console.error('CRITICAL: Could not find VariableSizeList in module', module);
    const ErrorComponent = React.forwardRef((props: any, ref) => (
      <div ref={ref as any} className="p-4 text-red-500 border border-red-300 rounded bg-red-50">
        Error: react-window module is empty or invalid.
      </div>
    ));
    return { default: ErrorComponent };
  }
  
  return { default: Component };
});

interface VirtualizedQuestionListProps {
  questions: Question[]
  expandedQuestionIds: Set<string>
  mostRecentExpandedId: string | null
  validationErrors: Map<string, any[]>
  onToggleExpand: (id: string) => void
  onEdit: (id: string, updates: Partial<Question>) => void
  onDuplicate: (index: number) => void
  onDelete: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onFocus: (question: Question) => void
  height: number
}

const VirtualizedQuestionList: React.FC<VirtualizedQuestionListProps> = ({
  questions,
  expandedQuestionIds,
  mostRecentExpandedId,
  validationErrors,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onFocus,
  height
}) => {
  const listRef = useRef<any>(null)
  
  // Cache for measured heights
  const measuredHeights = useRef<Map<string, number>>(new Map())
  
  // Refs for measuring actual DOM heights
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Estimate height based on content (fallback when not measured)
  const estimateHeight = useCallback((index: number): number => {
    const question = questions[index]
    const isExpanded = expandedQuestionIds.has(question.id)
    
    if (!isExpanded) {
      return 100 // Collapsed cards are consistently ~100px
    }
    
    // Expanded card estimation
    let height = 200 // Base
    
    // Options
    if (question.type === 'mcq_single' || question.type === 'mcq_multi' || question.type === 'true_false') {
      height += (question.options?.length || 0) * 50
    }
    
    // Diagram
    if (question.diagram?.present && question.diagram?.url) {
      height += 250
    }
    
    // Long text
    const textLength = question.text?.length || 0
    if (textLength > 200) {
      height += Math.min(Math.floor(textLength / 100) * 30, 150)
    }
    
    // Validation errors
    const errors = validationErrors.get(question.id) || []
    height += errors.length * 30
    
    // Padding
    height += 100
    
    return Math.min(height, 800)
  }, [questions, expandedQuestionIds, validationErrors])

  // Get height for an item (measured or estimated)
  const getItemSize = useCallback((index: number): number => {
    const question = questions[index]
    const cacheKey = `${question.id}-${expandedQuestionIds.has(question.id) ? 'expanded' : 'collapsed'}`
    
    // Return measured height if available
    const measured = measuredHeights.current.get(cacheKey)
    if (measured) {
      return measured
    }
    
    // Otherwise estimate
    return estimateHeight(index)
  }, [questions, expandedQuestionIds, estimateHeight])

  // Measure actual height after render
  const measureHeight = useCallback((questionId: string, isExpanded: boolean) => {
    const element = rowRefs.current.get(questionId)
    if (element) {
      const height = element.getBoundingClientRect().height
      const cacheKey = `${questionId}-${isExpanded ? 'expanded' : 'collapsed'}`
      
      // Only update if height changed significantly (>5px difference)
      const currentHeight = measuredHeights.current.get(cacheKey)
      if (!currentHeight || Math.abs(currentHeight - height) > 5) {
        measuredHeights.current.set(cacheKey, height)
        
        // Reset list to use new measurements
        if (listRef.current) {
          listRef.current.resetAfterIndex(0)
        }
      }
    }
  }, [])

  // Reset when expand/collapse changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0)
    }
  }, [expandedQuestionIds])

  // Row renderer with measurement
  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const question = questions[index]
    const isExpanded = expandedQuestionIds.has(question.id)
    
    // Measure after render
    useEffect(() => {
      measureHeight(question.id, isExpanded)
    }, [question.id, isExpanded])
    
    return (
      <div style={style}>
        <div 
          ref={(el) => {
            if (el) {
              rowRefs.current.set(question.id, el)
            }
          }}
          className="px-2 pb-2"
        >
          <CollapsibleQuestionCard
            key={question.id}
            question={question}
            index={index}
            totalQuestions={questions.length}
            isExpanded={isExpanded}
            isFocused={mostRecentExpandedId === question.id}
            validationErrors={validationErrors.get(question.id) || []}
            onToggleExpand={() => onToggleExpand(question.id)}
            onEdit={onEdit}
            onDuplicate={() => onDuplicate(index)}
            onDelete={() => onDelete(index)}
            onMoveUp={() => onMoveUp(index)}
            onMoveDown={() => onMoveDown(index)}
            onFocus={() => onFocus(question)}
          />
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center">Loading questions...</div>}>
      <VirtualList
        ref={listRef}
        height={height}
        itemCount={questions.length}
        itemSize={getItemSize}
        width="100%"
        overscanCount={3}
      >
        {Row}
      </VirtualList>
    </Suspense>
  )
}

export default VirtualizedQuestionList

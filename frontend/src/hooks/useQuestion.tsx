import { useMemo } from 'react'
import { NEGATIVE_MARKING_OPTIONS } from '@/config/question'

const useQuestion = (negativeMarkingScheme: string, marks: number, customNegativeMarks: number) => {
    
    const calculatedNegativeMarks = useMemo(() => {
        if (negativeMarkingScheme === 'none') return 0
        if (negativeMarkingScheme === 'custom') return customNegativeMarks
        
        const schemeOption = NEGATIVE_MARKING_OPTIONS.find(opt => opt.value === negativeMarkingScheme)
        if (schemeOption) {
          return -Math.abs(marks * schemeOption.fraction)
        }
        return 0
      }, [negativeMarkingScheme, marks, customNegativeMarks])

    return { calculatedNegativeMarks }
}

export default useQuestion
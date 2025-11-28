import { Input } from "@/components/ui/input"

import { NEGATIVE_MARKING_OPTIONS } from '@/config/question'
import React from "react"
import useQuestion from "@/hooks/useQuestion"

interface PropsType {
    marks: number,
    setMarks: (marks: number) => void,
    negativeMarkingScheme: string,
    setNegativeMarkingScheme: (negativeMarkingScheme: string) => void,
    customNegativeMarks: number,    
    setCustomNegativeMarks: (customNegativeMarks: number) => void,
}

const MarksConfiguration: React.FC<PropsType> = ({ marks, setMarks, negativeMarkingScheme, setNegativeMarkingScheme, customNegativeMarks, setCustomNegativeMarks }) => {
       const { calculatedNegativeMarks } = useQuestion(negativeMarkingScheme, marks, customNegativeMarks)
    return (
        <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Positive Marks
              </label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Negative Marking
              </label>
              <select
                value={negativeMarkingScheme}
                onChange={(e) => setNegativeMarkingScheme(e.target.value as any)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NEGATIVE_MARKING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {negativeMarkingScheme === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Negative Marks
              </label>
              <Input
                type="number"
                max="0"
                step="0.25"
                value={customNegativeMarks}
                onChange={(e) => setCustomNegativeMarks(Number(e.target.value))}
                placeholder="Enter negative value (e.g., -0.5)"
              />
            </div>
          )}

          {/* Show calculated negative marks */}
          {negativeMarkingScheme !== 'none' && (
            <div className="text-sm bg-blue-50 border border-blue-200 rounded p-2">
              <span className="font-medium text-gray-700">Effective Negative Marks: </span>
              <span className="text-red-600 font-semibold">{calculatedNegativeMarks.toFixed(2)}</span>
              <span className="text-gray-600 ml-2">
                (for incorrect answer)
              </span>
            </div>
          )}
        </div>
    )
}


export default MarksConfiguration
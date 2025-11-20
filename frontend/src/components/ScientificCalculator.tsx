import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Minimize2, Maximize2 } from 'lucide-react'

interface ScientificCalculatorProps {
  onClose: () => void
}

const ScientificCalculator: React.FC<ScientificCalculatorProps> = ({ onClose }) => {
  const [display, setDisplay] = useState('0')
  const [expression, setExpression] = useState('')
  const [memory, setMemory] = useState(0)
  const [currentValue, setCurrentValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDegrees, setIsDegrees] = useState(true)
  const displayRef = useRef<HTMLDivElement>(null)

  // Convert angle based on mode
  const toRadians = (angle: number) => isDegrees ? (angle * Math.PI) / 180 : angle
  const fromRadians = (radians: number) => isDegrees ? (radians * 180) / Math.PI : radians

  const handleNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num)
      setWaitingForOperand(false)
    } else {
      const newDisplay = display === '0' ? num : display + num
      // Limit display length to prevent overflow
      if (newDisplay.length <= 15) {
        setDisplay(newDisplay)
      }
    }
  }

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
    } else if (display.indexOf('.') === -1 && display.length < 15) {
      setDisplay(display + '.')
    }
  }

  const handleClear = () => {
    setDisplay('0')
    setExpression('')
    setCurrentValue(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const handleClearEntry = () => {
    setDisplay('0')
    setExpression('')
    setWaitingForOperand(false)
  }

  const handleBackspace = () => {
    if (!waitingForOperand) {
      const newDisplay = display.slice(0, -1)
      setDisplay(newDisplay || '0')
    }
  }

  const formatResult = (num: number): string => {
    if (isNaN(num)) return 'Error'
    if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity'
    
    // For very small or very large numbers, use scientific notation
    if (Math.abs(num) > 1e10 || (Math.abs(num) < 1e-6 && num !== 0)) {
      return num.toExponential(8)
    }
    
    // For normal numbers, limit decimal places
    const str = num.toString()
    if (str.includes('.')) {
      const parts = str.split('.')
      if (parts[1].length > 10) {
        return num.toFixed(10).replace(/\.?0+$/, '')
      }
    }
    
    return str
  }

  const calculate = (firstValue: number, secondValue: number, operator: string): number => {
    switch (operator) {
      case '+':
        return firstValue + secondValue
      case '-':
        return firstValue - secondValue
      case '*':
        return firstValue * secondValue
      case '/':
        return firstValue / secondValue
      case '^':
        return Math.pow(firstValue, secondValue)
      case 'mod':
        return firstValue % secondValue
      default:
        return secondValue
    }
  }

  const getOperatorSymbol = (op: string): string => {
    switch (op) {
      case '+': return '+'
      case '-': return '−'
      case '*': return '×'
      case '/': return '÷'
      case '^': return '^'
      case 'mod': return 'mod'
      default: return op
    }
  }

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display)

    if (currentValue === null) {
      setCurrentValue(inputValue)
      setExpression(`${display} ${getOperatorSymbol(nextOperator)}`)
    } else if (operator) {
      const newValue = calculate(currentValue, inputValue, operator)
      const resultStr = formatResult(newValue)
      setDisplay(resultStr)
      setExpression(`${resultStr} ${getOperatorSymbol(nextOperator)}`)
      setCurrentValue(newValue)
    } else {
      setExpression(`${display} ${getOperatorSymbol(nextOperator)}`)
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }

  const handleEquals = () => {
    const inputValue = parseFloat(display)

    if (currentValue !== null && operator) {
      const newValue = calculate(currentValue, inputValue, operator)
      const resultStr = formatResult(newValue)
      setExpression(`${expression} ${display} =`)
      setDisplay(resultStr)
      setCurrentValue(null)
      setOperator(null)
      setWaitingForOperand(true)
    }
  }

  const handleFunction = (func: string) => {
    const value = parseFloat(display)
    let result: number
    let funcName = ''

    switch (func) {
      case 'sin':
        result = Math.sin(toRadians(value))
        funcName = 'sin'
        break
      case 'cos':
        result = Math.cos(toRadians(value))
        funcName = 'cos'
        break
      case 'tan':
        result = Math.tan(toRadians(value))
        funcName = 'tan'
        break
      case 'asin':
        result = fromRadians(Math.asin(value))
        funcName = 'asin'
        break
      case 'acos':
        result = fromRadians(Math.acos(value))
        funcName = 'acos'
        break
      case 'atan':
        result = fromRadians(Math.atan(value))
        funcName = 'atan'
        break
      case 'sinh':
        result = Math.sinh(value)
        funcName = 'sinh'
        break
      case 'cosh':
        result = Math.cosh(value)
        funcName = 'cosh'
        break
      case 'tanh':
        result = Math.tanh(value)
        funcName = 'tanh'
        break
      case 'log':
        result = Math.log10(value)
        funcName = 'log'
        break
      case 'ln':
        result = Math.log(value)
        funcName = 'ln'
        break
      case 'sqrt':
        result = Math.sqrt(value)
        funcName = '√'
        break
      case 'square':
        result = value * value
        funcName = 'sqr'
        break
      case 'cube':
        result = value * value * value
        funcName = 'cube'
        break
      case 'factorial':
        result = factorial(value)
        funcName = '!'
        break
      case 'abs':
        result = Math.abs(value)
        funcName = 'abs'
        break
      case 'inverse':
        result = 1 / value
        funcName = '1/'
        break
      case 'exp':
        result = Math.exp(value)
        funcName = 'exp'
        break
      case 'pi':
        result = Math.PI
        funcName = 'π'
        break
      case 'e':
        result = Math.E
        funcName = 'e'
        break
      case 'negate':
        result = -value
        funcName = 'negate'
        break
      default:
        result = value
    }

    const resultStr = formatResult(result)
    if (funcName && func !== 'pi' && func !== 'e') {
      setExpression(`${funcName}(${display})`)
    } else if (func === 'pi' || func === 'e') {
      setExpression(funcName)
    }
    setDisplay(resultStr)
    setWaitingForOperand(true)
  }

  const factorial = (n: number): number => {
    if (n < 0) return NaN
    if (n === 0 || n === 1) return 1
    if (n !== Math.floor(n)) return NaN
    let result = 1
    for (let i = 2; i <= n; i++) {
      result *= i
    }
    return result
  }

  const handleMemory = (action: string) => {
    const value = parseFloat(display)

    switch (action) {
      case 'MC':
        setMemory(0)
        break
      case 'MR':
        setDisplay(formatResult(memory))
        setWaitingForOperand(true)
        break
      case 'M+':
        setMemory(memory + value)
        setWaitingForOperand(true)
        break
      case 'M-':
        setMemory(memory - value)
        setWaitingForOperand(true)
        break
      case 'MS':
        setMemory(value)
        setWaitingForOperand(true)
        break
    }
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      
      if (e.key >= '0' && e.key <= '9') {
        handleNumber(e.key)
      } else if (e.key === '.') {
        handleDecimal()
      } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        performOperation(e.key)
      } else if (e.key === 'Enter' || e.key === '=') {
        handleEquals()
      } else if (e.key === 'Escape') {
        handleClear()
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === '%') {
        performOperation('mod')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, currentValue, operator, waitingForOperand])

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          <Maximize2 className="mr-2 h-4 w-4" />
          Calculator
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="shadow-2xl border-2 border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardTitle className="text-lg font-semibold">Scientific Calculator</CardTitle>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-6 w-6 p-0 hover:bg-blue-400"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-blue-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-gray-50">
          {/* Display */}
          <div className="mb-3 rounded-lg bg-gray-900 border-2 border-gray-700 shadow-inner">
            {/* Expression display (shows operation) */}
            <div className="px-4 pt-3 pb-1 text-right text-sm font-mono text-gray-400 h-8 overflow-x-auto">
              {expression || '\u00A0'}
            </div>
            {/* Main display (shows current value) */}
            <div 
              ref={displayRef}
              className="px-4 pb-3 pt-1 text-right font-mono text-white overflow-x-auto min-h-[50px] flex items-center justify-end"
              style={{ wordBreak: 'break-word' }}
            >
              <span className="inline-block max-w-full text-3xl tracking-wide">{display}</span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="mb-2 flex justify-between items-center">
            <span className="text-xs text-gray-600">Angle Mode:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDegrees(!isDegrees)}
              className="text-xs h-6"
            >
              {isDegrees ? 'DEG' : 'RAD'}
            </Button>
            {memory !== 0 && (
              <span className="text-xs text-blue-600 font-semibold">M: {memory}</span>
            )}
          </div>

          {/* Memory Buttons */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {['MC', 'MR', 'M+', 'M-', 'MS'].map((btn) => (
              <Button
                key={btn}
                variant="outline"
                size="sm"
                onClick={() => handleMemory(btn)}
                className="text-xs h-7 bg-purple-50 hover:bg-purple-100 border-purple-200"
              >
                {btn}
              </Button>
            ))}
          </div>

          {/* Scientific Functions Row 1 */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {['sin', 'cos', 'tan', 'ln', 'log'].map((btn) => (
              <Button
                key={btn}
                variant="outline"
                size="sm"
                onClick={() => handleFunction(btn)}
                className="text-xs h-8 bg-blue-50 hover:bg-blue-100 border-blue-200"
              >
                {btn}
              </Button>
            ))}
          </div>

          {/* Scientific Functions Row 2 */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {['asin', 'acos', 'atan', 'sinh', 'cosh'].map((btn) => (
              <Button
                key={btn}
                variant="outline"
                size="sm"
                onClick={() => handleFunction(btn)}
                className="text-xs h-8 bg-blue-50 hover:bg-blue-100 border-blue-200"
              >
                {btn}
              </Button>
            ))}
          </div>

          {/* Scientific Functions Row 3 */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('sqrt')}
              className="text-xs h-8 bg-green-50 hover:bg-green-100 border-green-200"
            >
              √
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('square')}
              className="text-xs h-8 bg-green-50 hover:bg-green-100 border-green-200"
            >
              x²
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('cube')}
              className="text-xs h-8 bg-green-50 hover:bg-green-100 border-green-200"
            >
              x³
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => performOperation('^')}
              className="text-xs h-8 bg-green-50 hover:bg-green-100 border-green-200"
            >
              x^y
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('factorial')}
              className="text-xs h-8 bg-green-50 hover:bg-green-100 border-green-200"
            >
              n!
            </Button>
          </div>

          {/* Scientific Functions Row 4 */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('pi')}
              className="text-xs h-8 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
            >
              π
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('e')}
              className="text-xs h-8 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
            >
              e
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('exp')}
              className="text-xs h-8 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
            >
              exp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('abs')}
              className="text-xs h-8 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
            >
              |x|
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFunction('inverse')}
              className="text-xs h-8 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
            >
              1/x
            </Button>
          </div>

          {/* Basic Calculator Grid */}
          <div className="grid grid-cols-4 gap-1">
            <Button
              variant="outline"
              onClick={handleClear}
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700 font-semibold"
            >
              C
            </Button>
            <Button
              variant="outline"
              onClick={handleClearEntry}
              className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
            >
              CE
            </Button>
            <Button
              variant="outline"
              onClick={handleBackspace}
              className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
            >
              ⌫
            </Button>
            <Button
              variant="outline"
              onClick={() => performOperation('/')}
              className="bg-blue-100 hover:bg-blue-200 border-blue-300 font-semibold"
            >
              ÷
            </Button>

            {['7', '8', '9'].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleNumber(num)}
                className="bg-white hover:bg-gray-100 font-semibold"
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => performOperation('*')}
              className="bg-blue-100 hover:bg-blue-200 border-blue-300 font-semibold"
            >
              ×
            </Button>

            {['4', '5', '6'].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleNumber(num)}
                className="bg-white hover:bg-gray-100 font-semibold"
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => performOperation('-')}
              className="bg-blue-100 hover:bg-blue-200 border-blue-300 font-semibold"
            >
              −
            </Button>

            {['1', '2', '3'].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleNumber(num)}
                className="bg-white hover:bg-gray-100 font-semibold"
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => performOperation('+')}
              className="bg-blue-100 hover:bg-blue-200 border-blue-300 font-semibold"
            >
              +
            </Button>

            <Button
              variant="outline"
              onClick={() => handleFunction('negate')}
              className="bg-white hover:bg-gray-100"
            >
              ±
            </Button>
            <Button
              variant="outline"
              onClick={() => handleNumber('0')}
              className="bg-white hover:bg-gray-100 font-semibold"
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={handleDecimal}
              className="bg-white hover:bg-gray-100"
            >
              .
            </Button>
            <Button
              variant="outline"
              onClick={handleEquals}
              className="bg-green-500 hover:bg-green-600 text-white font-bold"
            >
              =
            </Button>
          </div>

          <div className="mt-2 text-xs text-gray-500 text-center">
            Keyboard shortcuts: Numbers, +, -, *, /, Enter/=, Esc, Backspace
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ScientificCalculator


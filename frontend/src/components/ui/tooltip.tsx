import React, { useState, createContext, useContext } from 'react'

const TooltipContext = createContext<{
  isVisible: boolean
  show: () => void
  hide: () => void
} | null>(null)

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

export const Tooltip = ({ children, delayDuration = 200 }: { children: React.ReactNode, delayDuration?: number }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const show = () => {
    const id = setTimeout(() => setIsVisible(true), delayDuration)
    setTimeoutId(id)
  }

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId)
    setIsVisible(false)
  }

  return (
    <TooltipContext.Provider value={{ isVisible, show, hide }}>
      <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

export const TooltipTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
  return <>{children}</>
}

export const TooltipContent = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  const context = useContext(TooltipContext)
  if (!context?.isVisible) return null

  return (
    <div className={`absolute z-50 px-2 py-1 text-xs text-white bg-black rounded shadow-lg -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 ${className}`}>
      {children}
      <div className="absolute w-2 h-2 bg-black transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
    </div>
  )
}

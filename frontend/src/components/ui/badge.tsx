import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  className = '' 
}) => {
  const variantStyles = {
    default: 'bg-primary/10 text-primary border-transparent',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    success: 'bg-green-500/15 text-green-700 dark:text-green-400 border-transparent',
    warning: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-transparent',
    danger: 'bg-destructive/15 text-destructive border-transparent',
    outline: 'text-foreground border-border'
  }
  
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

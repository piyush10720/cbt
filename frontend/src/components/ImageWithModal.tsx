import React, { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import ImageModal from './ImageModal'
import { cn } from '@/lib/utils'

interface ImageWithModalProps {
  src: string
  alt: string
  className?: string
}

const ImageWithModal: React.FC<ImageWithModalProps> = ({ src, alt, className }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div 
        className={cn("relative group cursor-zoom-in overflow-hidden rounded-md border bg-muted/10", className)}
        onClick={() => setIsOpen(true)}
      >
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-auto object-cover transition-transform group-hover:scale-105" 
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
           <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
        </div>
      </div>

      <ImageModal 
        src={src} 
        alt={alt} 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  )
}

export default ImageWithModal

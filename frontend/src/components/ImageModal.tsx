import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ImageModalProps {
  src: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

const ImageModal: React.FC<ImageModalProps> = ({ src, alt, isOpen, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-8 w-8" />
        </button>
        <div className="flex flex-col items-center justify-center w-full h-full p-4">
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain rounded-lg shadow-2xl"
          />
          {alt && <p className="absolute bottom-8 text-white/90 text-center text-base font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">{alt}</p>}
        </div>
      </div>
    </div>
  )
}

export default ImageModal


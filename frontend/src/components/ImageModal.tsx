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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-8 w-8" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-full h-auto rounded-lg shadow-2xl"
          style={{ objectFit: 'contain' }}
        />
        <p className="text-white text-center mt-2 text-sm">{alt}</p>
      </div>
    </div>
  )
}

export default ImageModal


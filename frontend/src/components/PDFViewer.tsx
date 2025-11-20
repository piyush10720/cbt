import React, { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Maximize2
} from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Set up PDF.js worker
// For react-pdf 7.x and pdfjs-dist 3.x
const PDFJS_VERSION = '3.11.174';

// Use CDN worker that matches the installed pdfjs-dist version
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfUrl: string
  currentPage?: number
  pagesToShow?: number[] // Array of page numbers to display
  onPageChange?: (page: number) => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

// Helper to check if URL is a proxy URL
const isProxyUrl = (url: string): boolean => {
  return url.includes('/api/proxy/pdf/view')
}

// Extract Cloudinary URL from proxy URL
const extractCloudinaryUrl = (proxyUrl: string): string | null => {
  try {
    const urlObj = new URL(proxyUrl)
    const cloudinaryUrl = urlObj.searchParams.get('url')
    return cloudinaryUrl
  } catch {
    return null
  }
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfUrl,
  currentPage = 1,
  pagesToShow,
  onPageChange,
  isMinimized = false,
  onToggleMinimize
}) => {
  const [numPages, setNumPages] = useState<number>(0)
  const [zoom, setZoom] = useState<number>(1.0)
  const [page, setPage] = useState<number>(currentPage)
  const [loadError, setLoadError] = useState<boolean>(false)
  const [useFallback, setUseFallback] = useState<boolean>(false)

  // Determine if we should use scroll mode (multiple pages) or single page mode
  const useScrollMode = pagesToShow && pagesToShow.length > 0
  // Filter out invalid page numbers
  const validPages = pagesToShow ? pagesToShow.filter(p => p > 0 && (!numPages || p <= numPages)) : []
  const displayPages = useScrollMode ? validPages : [page]

  // Determine which URL to use
  const effectivePdfUrl = React.useMemo(() => {
    if (!pdfUrl) return ''
    
    console.log('PDFViewer - Original URL:', pdfUrl)
    
    // If we need to use fallback
    if (useFallback) {
      if (isProxyUrl(pdfUrl)) {
        // Proxy URL failed, try direct Cloudinary
        const directUrl = extractCloudinaryUrl(pdfUrl)
        if (directUrl) {
          console.log('PDFViewer - Fallback: Using direct Cloudinary URL:', directUrl)
          return directUrl
        }
      } else if (pdfUrl.includes('cloudinary.com')) {
        // Direct Cloudinary failed, try proxy
        const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '')
        const proxyUrl = `${baseUrl}/api/proxy/pdf/view?url=${encodeURIComponent(pdfUrl)}`
        console.log('PDFViewer - Fallback: Using proxy URL:', proxyUrl)
        return proxyUrl
      }
    }
    
    console.log('PDFViewer - Using original URL:', pdfUrl)
    return pdfUrl
  }, [pdfUrl, useFallback])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoadError(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF Document load error:', error)
    setLoadError(true)
    
    // Try fallback approaches
    if (!useFallback) {
      if (isProxyUrl(pdfUrl)) {
        // If proxy failed, try direct Cloudinary URL
        console.log('Proxy failed, trying direct Cloudinary URL as fallback...')
        setUseFallback(true)
      } else if (pdfUrl.includes('cloudinary.com')) {
        // If direct Cloudinary failed, try proxy
        console.log('Direct Cloudinary failed, trying proxy URL as fallback...')
        setUseFallback(true)
      }
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) {
      setPage(newPage)
      onPageChange?.(newPage)
    }
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3.0))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5))
  }

  React.useEffect(() => {
    if (currentPage && currentPage !== page) {
      setPage(currentPage)
    }
  }, [currentPage])

  // Reset fallback when URL changes
  React.useEffect(() => {
    setUseFallback(false)
    setLoadError(false)
  }, [pdfUrl])

  if (!pdfUrl) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full p-8">
          <p className="text-gray-500">No PDF available</p>
        </CardContent>
      </Card>
    )
  }

  if (isMinimized) {
    return (
      <Card className="h-16">
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm font-medium">
            PDF Viewer {useScrollMode ? `(${displayPages.length} pages)` : `(Page ${page} of ${numPages})`}
          </span>
          <Button variant="ghost" size="sm" onClick={onToggleMinimize}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">PDF Viewer</CardTitle>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-600 min-w-[45px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            {/* Minimize Button */}
            {onToggleMinimize && (
              <Button variant="ghost" size="sm" onClick={onToggleMinimize}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4">
        {useScrollMode && displayPages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm">No pages to display</p>
              <p className="text-xs mt-2">Expand a question with a page number to view its source page</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Document
              file={effectivePdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              options={{
                cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
                cMapPacked: true,
                standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
                withCredentials: false
              }}
              loading={
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <p className="text-sm text-gray-600 mt-2">Loading PDF...</p>
                  {useFallback && <p className="text-xs text-gray-500 mt-1">(Using fallback URL)</p>}
                </div>
              }
              error={
                <div className="text-red-500 p-4 text-center">
                  <p className="font-medium mb-2">Failed to load PDF</p>
                  {useFallback ? (
                    <p className="text-sm text-gray-600 mb-2">
                      Both proxy and direct access failed. The PDF may not be accessible.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 mb-2">
                      The PDF proxy failed to load the document.
                    </p>
                  )}
                  <p className="text-xs text-gray-500 break-all mb-2">
                    URL: {effectivePdfUrl}
                  </p>
                  {!useFallback && isProxyUrl(pdfUrl) && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setUseFallback(true)}
                      className="mt-2"
                    >
                      Try Direct URL
                    </Button>
                  )}
                </div>
              }
            >
              {displayPages.map((pageNum, idx) => (
                <div key={pageNum} className="mb-4">
                  {useScrollMode && (
                    <div className="text-center text-xs text-gray-500 mb-2 bg-gray-100 py-1 px-3 rounded-full inline-block">
                      Page {pageNum}
                    </div>
                  )}
                  <Page
                    pageNumber={pageNum}
                    scale={zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              ))}
            </Document>
          </div>
        )}
      </CardContent>

      {/* Page Navigation - Only show in single page mode */}
      {!useScrollMode && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <span className="text-sm text-gray-600">
              Page {page} of {numPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= numPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Scroll Mode Info */}
      {useScrollMode && (
        <div className="border-t px-4 py-2 bg-gray-50">
          <p className="text-xs text-center text-gray-600">
            Showing {displayPages.length} page{displayPages.length !== 1 ? 's' : ''} (Pages: {displayPages.sort((a, b) => a - b).join(', ')})
          </p>
        </div>
      )}
    </Card>
  )
}

export default PDFViewer


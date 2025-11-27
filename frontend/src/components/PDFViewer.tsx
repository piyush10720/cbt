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
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
}

// PDFViewer component props interface
export interface PDFViewerProps {
  pdfUrl: string
  currentPage?: number
  pagesToShow?: number[] // Array of page numbers to display in scroll mode
  focusPage?: number | null // Page to focus/highlight (most recently expanded question)
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

const PDFViewer: React.FC<PDFViewerProps> = (props) => {
  const {
    pdfUrl,
    currentPage = 1,
    pagesToShow,
    focusPage,
    onPageChange,
    isMinimized = false,
    onToggleMinimize
  } = props
  const [numPages, setNumPages] = useState<number>(0)
  const [zoom, setZoom] = useState<number>(1.0)
  const [page, setPage] = useState<number>(currentPage)
  const [loadError, setLoadError] = useState<boolean>(false)
  const [useFallback, setUseFallback] = useState<boolean>(false)
  const focusPageRef = React.useRef<HTMLDivElement>(null)

  // Determine if we should use scroll mode (multiple pages) or single page mode
  const useScrollMode = pagesToShow && pagesToShow.length > 0
  // Filter out invalid page numbers
  const validPages = pagesToShow ? pagesToShow.filter(p => p > 0 && (!numPages || p <= numPages)) : []
  const displayPages = useScrollMode ? validPages : [page]

  // Scroll to focus page when it changes
  React.useEffect(() => {
    if (focusPage && useScrollMode && focusPageRef.current) {
      setTimeout(() => {
        focusPageRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        })
      }, 200)
    }
  }, [focusPage, useScrollMode])

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
    console.log('PDF loaded successfully:', { numPages, pdfUrl: effectivePdfUrl })
    setNumPages(numPages)
    setLoadError(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF Document load error:', error)
    setLoadError(true)
    setNumPages(0)
    
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

  if (!pdfUrl || !effectivePdfUrl) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full p-8">
          <div className="text-center">
            <p className="text-gray-500">No PDF available</p>
            <p className="text-xs text-gray-400 mt-2">Upload a PDF to view pages here</p>
          </div>
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

  const pdfOptions = React.useMemo(() => ({
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
    withCredentials: false,
    disableAutoFetch: false,
    disableStream: false,
    disableFontFace: false
  }), []);

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

      <CardContent className="flex-1 overflow-auto p-6 pt-8 pb-12">
        {useScrollMode && displayPages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm">No pages to display</p>
              <p className="text-xs mt-2">Expand a question with a page number to view its source page</p>
            </div>
          </div>
        ) : effectivePdfUrl && numPages > 0 || !loadError ? (
          <div className="flex flex-col items-center space-y-8 py-4">
            <Document
              file={effectivePdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              options={pdfOptions}
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
                      The PDF failed to load.
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
              {displayPages.map((pageNum, _idx) => {
                const isFocusPage = focusPage === pageNum
                // Only render valid page numbers
                if (pageNum < 1 || (numPages > 0 && pageNum > numPages)) {
                  return null
                }
                return (
                  <div 
                    key={pageNum} 
                    ref={isFocusPage ? focusPageRef : null}
                    className={`transition-all scroll-mt-20 ${isFocusPage ? 'ring-4 ring-blue-500 rounded-lg p-3 bg-blue-50' : 'p-2'}`}
                  >
                    {useScrollMode && (
                      <div className="text-center mb-3">
                        <span className={`text-xs py-1.5 px-4 rounded-full inline-block shadow-sm ${
                          isFocusPage 
                            ? 'bg-blue-600 text-white font-semibold' 
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          Page {pageNum} {isFocusPage && '• Current'}
                        </span>
                      </div>
                    )}
                    <div className={`${isFocusPage ? 'shadow-xl' : 'shadow-md'} rounded overflow-hidden`}>
                      <Page
                        key={`page-${pageNum}`}
                        pageNumber={pageNum}
                        scale={zoom}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
                          </div>
                        }
                        error={
                          <div className="p-4 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-600">Failed to render page {pageNum}</p>
                          </div>
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </Document>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm">PDF not available</p>
              <p className="text-xs mt-2">Expand questions with page numbers to view PDF</p>
            </div>
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
      {useScrollMode && displayPages.length > 0 && (
        <div className="border-t px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-center gap-3">
            <p className="text-xs text-gray-600">
              Showing <span className="font-semibold">{displayPages.length}</span> page{displayPages.length !== 1 ? 's' : ''}
            </p>
            <span className="text-gray-400">•</span>
            <p className="text-xs text-gray-500">
              Pages: {displayPages.sort((a, b) => a - b).join(', ')}
            </p>
            {focusPage && (
              <>
                <span className="text-gray-400">•</span>
                <p className="text-xs text-blue-600 font-medium">
                  Focus: Page {focusPage}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export default PDFViewer


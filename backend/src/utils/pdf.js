const { createCanvas } = require('@napi-rs/canvas')
const { PDFDocument } = require('pdf-lib')
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

const DEFAULT_PDF_DENSITY = 220

// Disable verbose font warnings from pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = null

// Aggressive warning suppression for pdfjs font issues
const originalWarn = console.warn
const originalError = console.error
const suppressedPatterns = [
  'getPathGenerator',
  'Times_path',
  'TT: undefined',
  'Requesting object that isn\'t resolved yet',
  'ignoring character'
]

console.warn = (...args) => {
  const msg = String(args[0] || '')
  if (suppressedPatterns.some(pattern => msg.includes(pattern))) {
    return // Suppress font/path warnings
  }
  originalWarn.apply(console, args)
}

console.error = (...args) => {
  const msg = String(args[0] || '')
  if (suppressedPatterns.some(pattern => msg.includes(pattern))) {
    return // Suppress font/path errors masquerading as warnings
  }
  originalError.apply(console, args)
}

/**
 * Split PDF into chunks to avoid token limits
 */
const splitPdfIntoChunks = async (pdfBuffer, { pagesPerChunk = 10 } = {}) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()
  const chunks = []

  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages)
    const newDoc = await PDFDocument.create()
    const copiedPages = await newDoc.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i))
    copiedPages.forEach((page) => newDoc.addPage(page))
    const buffer = Buffer.from(await newDoc.save())
    chunks.push({ buffer, startPage: start + 1, endPage: end })
  }

  return chunks
}

/**
 * Custom Canvas Factory for pdfjs-dist with @napi-rs/canvas
 * Prevents cleanup errors by providing safe destroy methods
 */
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height)
    return {
      canvas,
      context: canvas.getContext('2d')
    }
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }

  destroy(canvasAndContext) {
    // Safe cleanup - do nothing to avoid napi-rs/canvas errors
    // The canvas will be garbage collected naturally
    // Just nullify references to help GC
    try {
      if (canvasAndContext) {
        canvasAndContext.canvas = null
        canvasAndContext.context = null
      }
    } catch (e) {
      // Silently ignore any cleanup errors
    }
  }
}

/**
 * Convert a single PDF page to PNG using pdf.js
 * Pure JavaScript PDF rendering with canvas
 */
const renderPdfToPng = async (pdfBuffer, { page = 1, density = DEFAULT_PDF_DENSITY } = {}) => {
  try {
    const scale = density / 72 // PDF default is 72 DPI

    // Load PDF document with custom canvas factory
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      standardFontDataUrl: null,
      canvasFactory: new NodeCanvasFactory()
    })
    
    const pdfDocument = await loadingTask.promise
    
    // Get the specific page
    const pdfPage = await pdfDocument.getPage(page)
    const viewport = pdfPage.getViewport({ scale })
    
    // Create canvas
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
    const context = canvas.getContext('2d')
    
    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }
    
    await pdfPage.render(renderContext).promise
    
    // Convert canvas to PNG buffer
    const pngBuffer = canvas.toBuffer('image/png')
    
    // Cleanup - be careful with destroy
    try {
      pdfPage.cleanup()
    } catch (e) {
      // Ignore cleanup errors
    }
      
      return pngBuffer

  } catch (error) {
    console.error(`Failed to convert PDF page ${page} to PNG:`, error.message)
    throw new Error(`Could not render page ${page}: ${error.message}`)
  }
}

/**
 * Extract specific pages from PDF and create a new PDF with only those pages
 */
const extractSpecificPages = async (pdfBuffer, pageNumbers) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()
  
  // Validate and sort page numbers
  const validPages = [...new Set(pageNumbers)]
    .filter(p => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)
  
  if (validPages.length === 0) {
    throw new Error('No valid pages specified')
  }
  
  // Create new PDF with only specified pages
  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(
    pdfDoc, 
    validPages.map(p => p - 1) // Convert to 0-based index
  )
  copiedPages.forEach((page) => newDoc.addPage(page))
  
  const buffer = Buffer.from(await newDoc.save())
  
  return {
    buffer,
    pages: validPages,
    originalPageCount: totalPages,
    extractedPageCount: validPages.length
  }
}

module.exports = {
  renderPdfToPng,
  splitPdfIntoChunks,
  extractSpecificPages
}

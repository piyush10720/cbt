const sharp = require('sharp')
const { PDFDocument } = require('pdf-lib')
const pdf = require('pdf-poppler')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

const DEFAULT_PDF_DENSITY = 220

// Split PDF into chunks to avoid token limits
const splitPdfIntoChunks = async (pdfBuffer, { pagesPerChunk = 5 } = {}) => {
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

// Render a single PDF page to PNG buffer with Sharp first, pdf-poppler fallback
const renderPdfToPng = async (pdfBuffer, { page = 1, density = DEFAULT_PDF_DENSITY } = {}) => {
  const pageIndex = Math.max(page - 1, 0)
  
  // Try Sharp first (fast, works for most PDFs)
  try {
    const pngBuffer = await sharp(pdfBuffer, {
      density: Math.round(density),
      page: pageIndex
    })
      .ensureAlpha()
      .png()
      .toBuffer()
    
    return pngBuffer
  } catch (sharpError) {
    // Fall back to pdf-poppler for PDFs with complex embedded images
    console.warn(`Sharp failed on page ${page}, using pdf-poppler fallback...`)
    
    let tempPdfPath = null
    let tempOutputDir = null
    
    try {
      // Create temporary files
      tempPdfPath = path.join(os.tmpdir(), `temp-pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`)
      tempOutputDir = path.join(os.tmpdir(), `temp-output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      
      await fs.mkdir(tempOutputDir, { recursive: true })
      await fs.writeFile(tempPdfPath, pdfBuffer)
      
      // Convert specific page to PNG using pdf-poppler
      const options = {
        format: 'png',
        out_dir: tempOutputDir,
        out_prefix: 'page',
        page: page,
        scale: Math.max(1, Math.min(10, Math.round(density * 10 / 72))) // Scale 1-10
      }
      
      await pdf.convert(tempPdfPath, options)
      
      // Read the generated PNG
      const outputFile = path.join(tempOutputDir, `page-${page}.png`)
      const pngBuffer = await fs.readFile(outputFile)
      
      console.log(`✓ pdf-poppler rendered page ${page}`)
      
      return pngBuffer
    } catch (popplerError) {
      console.error(`Both Sharp and pdf-poppler failed for page ${page}:`, popplerError.message)
      throw new Error(`Could not render page ${page}`)
    } finally {
      // Cleanup temp files
      if (tempPdfPath) await fs.unlink(tempPdfPath).catch(() => {})
      if (tempOutputDir) await fs.rm(tempOutputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}

// Crop a bounding box from a PNG buffer
const cropBoundingBox = async (pagePngBuffer, diagram) => {
  if (!diagram || typeof diagram !== 'object' || !diagram.bounding_box) {
    throw new Error('Invalid diagram metadata for cropping')
  }

  const { x, y, width, height } = diagram.bounding_box
  if ([x, y, width, height].some((value) => typeof value !== 'number')) {
    throw new Error('Bounding box must contain numeric coordinates')
  }

  const image = sharp(pagePngBuffer)
  const metadata = await image.metadata()

  const pageWidth = diagram.page_width || metadata.width || 1
  const pageHeight = diagram.page_height || metadata.height || 1

  const scaleX = (metadata.width || pageWidth) / pageWidth
  const scaleY = (metadata.height || pageHeight) / pageHeight

  const left = Math.max(Math.round(x * scaleX), 0)
  const top = Math.max(Math.round(y * scaleY), 0)
  const cropWidth = Math.max(Math.round(width * scaleX), 1)
  const cropHeight = Math.max(Math.round(height * scaleY), 1)

  const maxWidth = (metadata.width || cropWidth) - left
  const maxHeight = (metadata.height || cropHeight) - top

  const safeWidth = Math.min(cropWidth, maxWidth)
  const safeHeight = Math.min(cropHeight, maxHeight)

  if (safeWidth <= 0 || safeHeight <= 0) {
    throw new Error('Calculated crop box is outside of page bounds')
  }

  return image
    .extract({
      left,
      top,
      width: safeWidth,
      height: safeHeight
    })
    .ensureAlpha()
    .png()
    .toBuffer()
}

module.exports = {
  renderPdfToPng,
  cropBoundingBox,
  splitPdfIntoChunks
}

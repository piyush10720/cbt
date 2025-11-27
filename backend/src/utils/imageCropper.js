const sharp = require('sharp')



// Handle different pdf-to-png module formats
let pdfToPng;
try {
  const pdfToPngModule = require('pdf-to-png');
  pdfToPng = pdfToPngModule.default || pdfToPngModule.pdfToPng || pdfToPngModule;
  if (typeof pdfToPng !== 'function') {
    throw new Error('pdf-to-png export is not a function');
  }
} catch (error) {
  console.error('⚠️ Failed to load pdf-to-png:', error.message);
  console.error('Trying alternative pdf conversion method...');
  // Fallback will be handled in convertPdfPageToImage
  pdfToPng = null;
}

/**
 * Custom Canvas Factory for pdfjs-dist with @napi-rs/canvas
 * Prevents cleanup errors by providing safe destroy methods
 */
class NodeCanvasFactory {
  create(width, height) {
    const { createCanvas } = require('@napi-rs/canvas');
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
 * Image Cropper Utility
 * Provides functions to convert PDF pages to images and crop based on bounding boxes
 * Uses sharp as primary library with Jimp as fallback
 */
class ImageCropper {
  constructor() {
    // No preferred library needed as we only use Sharp
  }

  /**
   * Convert a PDF page to PNG image using pdfjs-dist (fallback method)
   * @param {Buffer} pdfBuffer - The PDF file buffer
   * @param {number} pageNumber - Page number (1-indexed)
   * @returns {Promise<Buffer>} - PNG image buffer
   */
  async convertPdfPageWithPdfJs(pdfBuffer, pageNumber = 1) {
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      const { createCanvas } = require('@napi-rs/canvas');
      
      // Load PDF with custom canvas factory
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
        disableFontFace: false,
        canvasFactory: new NodeCanvasFactory()
      });
      
      const pdfDocument = await loadingTask.promise;
      
      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        throw new Error(`Page number ${pageNumber} is out of range (1-${pdfDocument.numPages})`);
      }
      
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher quality
      
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Convert canvas to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Safe cleanup
      try {
        page.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
      
      return buffer;
    } catch (error) {
      console.error(`   ⚠️ pdfjs fallback failed:`, error.message);
      throw error;
    }
  }

  /**
   * Convert a PDF page to PNG image
   * @param {Buffer} pdfBuffer - The PDF file buffer
   * @param {number} pageNumber - Page number (1-indexed)
   * @returns {Promise<Buffer>} - PNG image buffer
   */
  async convertPdfPageToImage(pdfBuffer, pageNumber = 1) {
    try {
      console.log(`   📄 Converting PDF page ${pageNumber} to image...`)
      
      // Try pdf-to-png first (if available)
      if (pdfToPng) {
        try {
          const pngPages = await pdfToPng(pdfBuffer, {
            disableFontFace: false,
            useSystemFonts: false,
            viewportScale: 2.0, // Higher quality
            outputFolder: null, // Return buffers instead of saving to disk
            strictPagesToProcess: true,
            pagesToProcess: [pageNumber], // Only convert the specified page
            outputFileMask: 'page'
          })

          if (!pngPages || pngPages.length === 0) {
            throw new Error(`Failed to convert PDF page ${pageNumber}`)
          }

          console.log(`   ✅ PDF page ${pageNumber} converted successfully (pdf-to-png)`)
          return pngPages[0].content // Return the buffer
        } catch (pdfToPngError) {
          console.warn(`   ⚠️ pdf-to-png failed, trying pdfjs fallback...`);
          // Fall through to pdfjs fallback
        }
      }
      
      // Fallback to pdfjs-dist
      console.log(`   🔄 Using pdfjs-dist fallback for PDF conversion...`);
      const buffer = await this.convertPdfPageWithPdfJs(pdfBuffer, pageNumber);
      console.log(`   ✅ PDF page ${pageNumber} converted successfully (pdfjs)`)
      return buffer;
      
    } catch (error) {
      console.error(`   ❌ Error converting PDF page ${pageNumber}:`, error.message)
      throw error
    }
  }

  /**
   * Normalize bounding box coordinates
   * Gemini might return coordinates in different formats (0-1 normalized, pixel values, or percentages)
   * @param {Object} bbox - Bounding box with x, y, width, height (or x1, y1, x2, y2)
   * @param {number} imageWidth - Width of the source image
   * @param {number} imageHeight - Height of the source image
   * @returns {Object} - Normalized bounding box in pixels
   */
  normalizeBoundingBox(bbox, imageWidth, imageHeight) {
    let { x, y, width, height } = bbox
    
    // Handle x1, y1, x2, y2 format
    if (bbox.x1 !== undefined && bbox.y1 !== undefined && 
        bbox.x2 !== undefined && bbox.y2 !== undefined) {
      x = bbox.x1
      y = bbox.y1
      width = bbox.x2 - bbox.x1
      height = bbox.y2 - bbox.y1
    }

    // Convert normalized coordinates (0-1) to pixels
    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      x = Math.floor(x * imageWidth)
      y = Math.floor(y * imageHeight)
      width = Math.floor(width * imageWidth)
      height = Math.floor(height * imageHeight)
    }

    // Ensure coordinates are within image bounds
    x = Math.max(0, Math.min(x, imageWidth))
    y = Math.max(0, Math.min(y, imageHeight))
    width = Math.min(width, imageWidth - x)
    height = Math.min(height, imageHeight - y)

    // Ensure minimum dimensions
    width = Math.max(10, width)
    height = Math.max(10, height)

    return { x: Math.floor(x), y: Math.floor(y), width: Math.floor(width), height: Math.floor(height) }
  }

  /**
   * Crop image using Sharp (primary method)
   * @param {Buffer} imageBuffer - Source image buffer
   * @param {Object} boundingBox - Bounding box {x, y, width, height}
   * @returns {Promise<Buffer>} - Cropped image buffer
   */
  async cropImageWithSharp(imageBuffer, boundingBox) {
    try {
      const image = sharp(imageBuffer)
      const metadata = await image.metadata()
      
      const normalizedBox = this.normalizeBoundingBox(
        boundingBox, 
        metadata.width, 
        metadata.height
      )

      console.log(`   ✂️  Cropping with Sharp: ${normalizedBox.width}x${normalizedBox.height} at (${normalizedBox.x}, ${normalizedBox.y})`)

      const croppedBuffer = await image
        .extract({
          left: normalizedBox.x,
          top: normalizedBox.y,
          width: normalizedBox.width,
          height: normalizedBox.height
        })
        .png()
        .toBuffer()

      return croppedBuffer
    } catch (error) {
      console.error('   ⚠️  Sharp cropping failed:', error.message)
      throw error
    }
  }



  /**
   * Crop image with automatic fallback
   * @param {Buffer} imageBuffer - Source image buffer
   * @param {Object} boundingBox - Bounding box {x, y, width, height}
   * @returns {Promise<Buffer>} - Cropped image buffer
   */
  async cropImage(imageBuffer, boundingBox) {
    if (!imageBuffer || !boundingBox) {
      throw new Error('Image buffer and bounding box are required')
    }

    // Use Sharp
    try {
      return await this.cropImageWithSharp(imageBuffer, boundingBox)
    } catch (sharpError) {
      console.error('   ❌ Sharp cropping failed:', sharpError.message)
      throw sharpError
    }
  }

  /**
   * Crop multiple regions from a PDF page
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {number} pageNumber - Page number (1-indexed)
   * @param {Array<Object>} boundingBoxes - Array of bounding boxes
   * @returns {Promise<Array<Buffer>>} - Array of cropped image buffers
   */
  async cropMultipleRegionsFromPdf(pdfBuffer, pageNumber, boundingBoxes) {
    try {
      // Convert PDF page to image once
      const pageImage = await this.convertPdfPageToImage(pdfBuffer, pageNumber)
      
      // Crop all regions
      const croppedImages = []
      for (let i = 0; i < boundingBoxes.length; i++) {
        console.log(`   🔍 Processing region ${i + 1}/${boundingBoxes.length}...`)
        const cropped = await this.cropImage(pageImage, boundingBoxes[i])
        croppedImages.push(cropped)
      }

      return croppedImages
    } catch (error) {
      console.error('   ❌ Error cropping multiple regions:', error.message)
      throw error
    }
  }

  /**
   * Test if libraries are working correctly
   * @returns {Promise<Object>} - Test results
   */
  async testLibraries() {
    const results = {
      sharp: false,
      jimp: false
    }

    // Test Sharp
    try {
      const testBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      await sharp(testBuffer).metadata()
      results.sharp = true
      console.log('✅ Sharp is working')
    } catch (error) {
      console.warn('⚠️  Sharp test failed:', error.message)
    }

    // Test Jimp (Removed)
    results.jimp = false // Jimp is removed

    return results
  }
}

module.exports = new ImageCropper()


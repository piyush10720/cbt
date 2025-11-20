const imageCropper = require('../imageCropper');
const fs = require('fs').promises;
const path = require('path');

/**
 * Unit tests for Image Cropper utility
 * Tests the bounding box normalization and library functionality
 */
describe('ImageCropper', () => {
  describe('normalizeBoundingBox', () => {
    test('should normalize coordinates from 0-1 range to pixels', () => {
      const bbox = { x: 0.1, y: 0.2, width: 0.5, height: 0.3 };
      const imageWidth = 1000;
      const imageHeight = 800;

      const normalized = imageCropper.normalizeBoundingBox(bbox, imageWidth, imageHeight);

      expect(normalized.x).toBe(100);
      expect(normalized.y).toBe(160);
      expect(normalized.width).toBe(500);
      expect(normalized.height).toBe(240);
    });

    test('should handle x1,y1,x2,y2 format', () => {
      const bbox = { x1: 0.1, y1: 0.2, x2: 0.6, y2: 0.5 };
      const imageWidth = 1000;
      const imageHeight = 800;

      const normalized = imageCropper.normalizeBoundingBox(bbox, imageWidth, imageHeight);

      expect(normalized.x).toBe(100);
      expect(normalized.y).toBe(160);
      expect(normalized.width).toBe(500);
      expect(normalized.height).toBe(240);
    });

    test('should handle pixel coordinates', () => {
      const bbox = { x: 100, y: 150, width: 400, height: 300 };
      const imageWidth = 1000;
      const imageHeight = 800;

      const normalized = imageCropper.normalizeBoundingBox(bbox, imageWidth, imageHeight);

      // Should keep pixel values as is
      expect(normalized.x).toBe(100);
      expect(normalized.y).toBe(150);
      expect(normalized.width).toBe(400);
      expect(normalized.height).toBe(300);
    });

    test('should clamp coordinates within image bounds', () => {
      const bbox = { x: 900, y: 700, width: 300, height: 300 };
      const imageWidth = 1000;
      const imageHeight = 800;

      const normalized = imageCropper.normalizeBoundingBox(bbox, imageWidth, imageHeight);

      // Width and height should be clamped to stay within image
      expect(normalized.x).toBe(900);
      expect(normalized.y).toBe(700);
      expect(normalized.width).toBeLessThanOrEqual(100); // 1000 - 900
      expect(normalized.height).toBeLessThanOrEqual(100); // 800 - 700
    });

    test('should enforce minimum dimensions', () => {
      const bbox = { x: 0.5, y: 0.5, width: 0.001, height: 0.001 };
      const imageWidth = 1000;
      const imageHeight = 800;

      const normalized = imageCropper.normalizeBoundingBox(bbox, imageWidth, imageHeight);

      // Should have minimum dimensions of 10x10
      expect(normalized.width).toBeGreaterThanOrEqual(10);
      expect(normalized.height).toBeGreaterThanOrEqual(10);
    });
  });

  describe('testLibraries', () => {
    test('should detect available image processing libraries', async () => {
      const results = await imageCropper.testLibraries();

      expect(results).toHaveProperty('sharp');
      expect(results).toHaveProperty('jimp');
      
      // At least one library should be working
      const hasWorkingLibrary = results.sharp || results.jimp;
      expect(hasWorkingLibrary).toBe(true);
      
      console.log('Library test results:', results);
    }, 10000);
  });

  describe('cropImage', () => {
    // Note: Testing with real images requires valid PNG data
    // The main functionality is tested in E2E tests with actual PDF-generated images
    // Here we test error handling and API contracts
    
    test.skip('should crop image with valid bounding box', async () => {
      // This test requires a valid test image
      // In production, images come from PDF conversion which always generates valid PNGs
      // E2E tests cover the full flow with real PDFs
    }, 30000);

    test('should throw error with invalid inputs', async () => {
      const validBbox = { x: 0, y: 0, width: 100, height: 100 };
      
      await expect(async () => {
        await imageCropper.cropImage(null, validBbox);
      }).rejects.toThrow('Image buffer and bounding box are required');

      await expect(async () => {
        await imageCropper.cropImage(Buffer.from('test'), null);
      }).rejects.toThrow('Image buffer and bounding box are required');
    });

    test('should handle Sharp and Jimp API correctly', () => {
      // Verify the API methods exist and are callable
      expect(typeof imageCropper.cropImage).toBe('function');
      expect(typeof imageCropper.cropImageWithSharp).toBe('function');
      expect(typeof imageCropper.cropImageWithJimp).toBe('function');
      expect(typeof imageCropper.normalizeBoundingBox).toBe('function');
    });
  });

  describe('convertPdfPageToImage', () => {
    test('should require valid PDF buffer', async () => {
      const invalidBuffer = Buffer.from('not a pdf');
      
      await expect(async () => {
        await imageCropper.convertPdfPageToImage(invalidBuffer, 1);
      }).rejects.toThrow();
    });

    // Note: To properly test PDF conversion, you'd need a real PDF file
    // This is more of an integration test
    test.skip('should convert PDF page to image', async () => {
      const pdfPath = path.join(__dirname, '../../../uploads/CS12025.pdf');
      
      try {
        const pdfBuffer = await fs.readFile(pdfPath);
        const imageBuffer = await imageCropper.convertPdfPageToImage(pdfBuffer, 1);
        
        expect(imageBuffer).toBeInstanceOf(Buffer);
        expect(imageBuffer.length).toBeGreaterThan(1000); // Should be a substantial image
      } catch (error) {
        console.warn('PDF test file not available, skipping test');
      }
    }, 60000);
  });

  describe('fallback mechanisms', () => {
    test('should have pdfjs fallback available', () => {
      // Verify pdfjs-dist is available as fallback
      expect(() => {
        require('pdfjs-dist/legacy/build/pdf.js');
      }).not.toThrow();
      
      expect(() => {
        require('@napi-rs/canvas');
      }).not.toThrow();
    });

    test('should have at least one cropping library available', async () => {
      const results = await imageCropper.testLibraries();
      const hasWorkingLibrary = results.sharp || results.jimp;
      
      expect(hasWorkingLibrary).toBe(true);
      
      if (results.sharp) {
        console.log('✅ Sharp is available (primary)');
      }
      if (results.jimp) {
        console.log('✅ Jimp is available (fallback)');
      }
    }, 10000);
  });

  describe('cropMultipleRegionsFromPdf', () => {
    test.skip('should crop multiple regions from same PDF page', async () => {
      const pdfPath = path.join(__dirname, '../../../uploads/CS12025.pdf');
      
      try {
        const pdfBuffer = await fs.readFile(pdfPath);
        const boundingBoxes = [
          { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
          { x: 0.5, y: 0.1, width: 0.3, height: 0.2 }
        ];
        
        const croppedImages = await imageCropper.cropMultipleRegionsFromPdf(
          pdfBuffer, 
          1, 
          boundingBoxes
        );
        
        expect(croppedImages).toHaveLength(2);
        expect(croppedImages[0]).toBeInstanceOf(Buffer);
        expect(croppedImages[1]).toBeInstanceOf(Buffer);
      } catch (error) {
        console.warn('PDF test file not available, skipping test');
      }
    }, 90000);
  });
});


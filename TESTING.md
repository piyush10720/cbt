# Testing Guide - CBT Platform

## Overview

This document describes how to run and understand tests for the CBT Platform's image extraction system.

## Prerequisites

Before running tests, ensure you have:

1. **Node.js** (v16 or higher)
2. **NPM** (comes with Node.js)
3. **Environment variables** configured in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_VISION_MODEL=gemini-2.0-flash-exp
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   CLOUDINARY_FOLDER=cbt-diagrams
   ```

4. **Test PDFs** (optional for E2E tests):
   - Place test PDFs in `backend/uploads/` directory
   - Default expected files: `CS12025.pdf` and `CS1_Keys.pdf`

## Test Structure

The platform has three types of tests:

### 1. Unit Tests (Jest)
Located in `backend/src/**/__tests__/`

- **Image Cropper Tests** (`backend/src/utils/__tests__/imageCropper.test.js`)
  - Bounding box normalization
  - Coordinate format conversion
  - Library availability detection
  - Image cropping functionality
  - Fallback mechanisms

### 2. Integration Tests (Jest)
Located in `backend/src/__tests__/`

- **Exam Creation Tests** (`backend/src/__tests__/createExam.integration.test.js`)
  - Full exam creation flow
  - Database interactions

### 3. E2E Tests (Playwright)
Located in `tests/`

- **Image Extraction Tests** (`tests/image-extraction.spec.ts`)
  - Complete PDF upload flow
  - Gemini bounding box extraction
  - Image cropping and upload
  - Cloudinary integration
  - UI verification

## Running Tests

### Quick Start - All Tests

```bash
# PowerShell (Windows)
.\run-tests.ps1

# Bash (Linux/Mac)
./run-tests.sh

# Or using npm scripts
npm test
```

### Unit Tests Only

```bash
# PowerShell
.\run-tests.ps1 -UnitOnly

# Bash
./run-tests.sh --unit-only

# Or using npm
npm run test:unit
```

### E2E Tests Only

```bash
# PowerShell
.\run-tests.ps1 -E2EOnly

# Bash
./run-tests.sh --e2e-only

# Or using npm
npm run test:e2e
```

### Image Cropper Tests Only

```bash
# PowerShell
.\run-tests.ps1 -ImageCropperOnly

# Or using npm
npm run test:image-cropper
```

### Playwright UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

### Playwright Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

## NPM Test Scripts

All available test scripts in `package.json`:

```json
{
  "test": "npm run test:unit && npm run test:e2e",
  "test:unit": "cd backend && npm test",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed",
  "test:report": "playwright show-report",
  "test:image-cropper": "cd backend && npm test -- src/utils/__tests__/imageCropper.test.js"
}
```

## Test Coverage

### Image Cropper Unit Tests

✅ **normalizeBoundingBox**
- Converts normalized coordinates (0-1) to pixels
- Handles x1,y1,x2,y2 format
- Handles pixel coordinates
- Clamps coordinates within image bounds
- Enforces minimum dimensions

✅ **testLibraries**
- Detects Sharp availability
- Detects Jimp availability
- Verifies at least one library is working

✅ **cropImage**
- Crops images with valid bounding boxes
- Throws errors on invalid inputs
- Automatically falls back to Jimp if Sharp fails

✅ **convertPdfPageToImage**
- Requires valid PDF buffer
- Converts PDF pages to PNG images
- Falls back to pdfjs-dist if pdf-to-png fails

✅ **Fallback Mechanisms**
- Verifies pdfjs-dist is available
- Verifies @napi-rs/canvas is available
- Confirms at least one cropping library works

✅ **cropMultipleRegionsFromPdf**
- Crops multiple regions from same PDF page efficiently

### E2E Image Extraction Tests

✅ **Authentication**
- User login flow
- Token management

✅ **PDF Upload**
- Upload question paper
- Upload answer key
- Parse PDFs with Gemini

✅ **Image Extraction**
- Request bounding boxes from Gemini
- Convert PDF pages to images
- Crop images using bounding boxes
- Upload to Cloudinary
- Verify image URLs are accessible

✅ **Exam Creation**
- Create exam with extracted images
- Verify images display correctly
- Check image quality and dimensions

## Expected Results

### Unit Tests
```
PASS  backend/src/utils/__tests__/imageCropper.test.js
  ImageCropper
    normalizeBoundingBox
      ✓ should normalize coordinates from 0-1 range to pixels
      ✓ should handle x1,y1,x2,y2 format
      ✓ should handle pixel coordinates
      ✓ should clamp coordinates within image bounds
      ✓ should enforce minimum dimensions
    testLibraries
      ✓ should detect available image processing libraries (XXXms)
    cropImage
      ✓ should crop image with valid bounding box (XXXms)
      ✓ should throw error with invalid inputs
    convertPdfPageToImage
      ✓ should require valid PDF buffer
    fallback mechanisms
      ✓ should have pdfjs fallback available
      ✓ should have at least one cropping library available (XXXms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

### E2E Tests
```
Running 4 tests using 1 worker

  ✓ [chromium] › image-extraction.spec.ts:44:3 › should login successfully (XXXms)
  ✓ [chromium] › image-extraction.spec.ts:66:3 › should upload PDFs and extract images (XXXms)
  ✓ [chromium] › image-extraction.spec.ts:139:3 › should create exam with extracted images (XXXms)
  ✓ [chromium] › image-extraction.spec.ts:211:3 › should verify image cropping quality (XXXms)

  4 passed (XXXm)
```

## Troubleshooting

### Issue: "Module not found: pdf-to-png"

**Solution:**
```bash
cd backend
npm install pdf-to-png --save
```

### Issue: "Sharp installation failed"

**Solution:**
```bash
cd backend
npm rebuild sharp
# Or
npm uninstall sharp
npm install sharp --save
```

The system will automatically fall back to Jimp if Sharp fails.

### Issue: "pdfjs-dist not working"

**Solution:**
```bash
cd backend
npm install pdfjs-dist @napi-rs/canvas --save
```

### Issue: "Playwright browsers not installed"

**Solution:**
```bash
npx playwright install chromium
```

### Issue: "Test PDFs not found"

For unit tests, this is normal - most tests use mock data or are skipped.

For E2E tests, you need actual test PDFs:
1. Place test PDFs in `backend/uploads/`
2. Update paths in `tests/image-extraction.spec.ts` if needed

### Issue: "Cloudinary upload failed"

**Solution:**
1. Verify credentials in `backend/.env`
2. Test manually: https://cloudinary.com/console
3. Check if free tier quota is exceeded

### Issue: "Gemini API rate limit"

**Solution:**
1. Wait a few seconds between test runs
2. The system has automatic retry with exponential backoff
3. Check API quota: https://makersuite.google.com/app/apikey

### Issue: "Tests timing out"

E2E tests can take 5+ minutes due to:
- PDF parsing with AI
- Image extraction
- Multiple API calls

**Solution:**
- Be patient - this is normal
- Check console logs for progress
- Increase timeout in `playwright.config.ts` if needed

## Environment Variables for Testing

Create `backend/.env.test` for test-specific configuration:

```env
# Gemini API
GEMINI_API_KEY=your_test_api_key
GEMINI_MODEL=gemini-flash-lite-latest
GEMINI_VISION_MODEL=gemini-2.0-flash-exp

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_test_cloud
CLOUDINARY_API_KEY=your_test_key
CLOUDINARY_API_SECRET=your_test_secret
CLOUDINARY_FOLDER=cbt-test-diagrams

# MongoDB
MONGODB_URI=mongodb://localhost:27017/cbt-platform-test

# JWT
JWT_SECRET=test_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# Other
PORT=3001
NODE_ENV=test
```

## Debugging Tests

### Enable Verbose Logging

**Jest (Unit Tests):**
```bash
cd backend
npm test -- --verbose
```

**Playwright (E2E Tests):**
```bash
# Debug mode with browser UI
npx playwright test --debug

# Headed mode to see browser
npx playwright test --headed

# Show trace viewer
npm run test:report
```

### View Detailed Logs

Unit tests output to console with emoji indicators:
- 📄 = PDF conversion
- ✂️ = Image cropping
- ✅ = Success
- ⚠️ = Warning/fallback
- ❌ = Error

E2E tests generate:
- Screenshots on failure: `test-results/`
- Videos on failure: `test-results/`
- HTML report: `playwright-report/`

### Test Individual Files

```bash
# Specific Jest test
cd backend
npm test -- src/utils/__tests__/imageCropper.test.js

# Specific Playwright test
npx playwright test tests/image-extraction.spec.ts

# Specific test case
npx playwright test tests/image-extraction.spec.ts -g "should upload PDFs"
```

## Continuous Integration (CI)

To run tests in CI environments:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install
          cd backend && npm install
          cd ../frontend && npm install
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run unit tests
        run: npm run test:unit
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          CLOUDINARY_CLOUD_NAME: ${{ secrets.CLOUDINARY_CLOUD_NAME }}
          CLOUDINARY_API_KEY: ${{ secrets.CLOUDINARY_API_KEY }}
          CLOUDINARY_API_SECRET: ${{ secrets.CLOUDINARY_API_SECRET }}
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          CLOUDINARY_CLOUD_NAME: ${{ secrets.CLOUDINARY_CLOUD_NAME }}
          CLOUDINARY_API_KEY: ${{ secrets.CLOUDINARY_API_KEY }}
          CLOUDINARY_API_SECRET: ${{ secrets.CLOUDINARY_API_SECRET }}
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Performance Benchmarks

Expected execution times (approximate):

| Test Suite | Time | Notes |
|------------|------|-------|
| Image Cropper Unit Tests | 5-10s | Fast, mostly synchronous |
| Integration Tests | 30-60s | Includes database operations |
| E2E Tests | 3-5 min | Includes PDF parsing, AI calls |
| Full Test Suite | 5-10 min | All tests combined |

## Best Practices

1. **Run unit tests frequently** during development
2. **Run E2E tests before commits** to catch integration issues
3. **Use `test:e2e:ui`** when debugging Playwright tests
4. **Check test reports** after failures for screenshots/videos
5. **Keep test PDFs small** (< 5 pages) for faster tests
6. **Mock external APIs** in unit tests when possible
7. **Use `.skip`** for tests requiring special setup
8. **Document flaky tests** and investigate root causes

## Adding New Tests

### New Unit Test

```javascript
// backend/src/utils/__tests__/myFeature.test.js
const myFeature = require('../myFeature');

describe('MyFeature', () => {
  test('should do something', () => {
    const result = myFeature.doSomething();
    expect(result).toBe(expectedValue);
  });
});
```

### New E2E Test

```typescript
// tests/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('my feature works', async ({ page }) => {
  await page.goto('/');
  await page.click('button');
  await expect(page.locator('.result')).toBeVisible();
});
```

## Support

For issues or questions:
1. Check this guide first
2. Review console logs for error details
3. Check `playwright-report/` for E2E test failures
4. Review `IMAGE_EXTRACTION_IMPLEMENTATION.md` for system details
5. Create an issue with:
   - Error messages
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

## Summary

The CBT Platform has comprehensive tests covering:
- ✅ Image cropping with multiple fallbacks
- ✅ PDF to image conversion with fallbacks
- ✅ Bounding box detection via Gemini AI
- ✅ Cloudinary upload and storage
- ✅ End-to-end exam creation flow
- ✅ Image quality verification

All tests are designed to be robust with multiple fallback mechanisms to ensure reliability across different environments.

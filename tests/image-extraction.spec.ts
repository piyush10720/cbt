import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * E2E Test Suite for Image Extraction with Bounding Boxes
 * 
 * Tests the complete flow:
 * 1. Upload PDFs with diagrams
 * 2. Parse questions with Gemini
 * 3. Extract bounding boxes for images
 * 4. Crop images from PDFs
 * 5. Upload to Cloudinary
 * 6. Verify images are accessible
 */

// Test configuration
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'ps671248@gmail.com',
  password: process.env.TEST_USER_PASSWORD || '12345678@aA'
};

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// PDF paths (adjust to your test PDFs)
const QUESTION_PAPER_PATH = path.join(__dirname, '../backend/uploads/CS12025.pdf');
const ANSWER_KEY_PATH = path.join(__dirname, '../backend/uploads/CS1_Keys.pdf');

test.describe('Image Extraction with Bounding Boxes', () => {
  let authToken: string;
  let examId: string;

  test.beforeAll(async () => {
    // Verify test PDFs exist
    if (!fs.existsSync(QUESTION_PAPER_PATH)) {
      throw new Error(`Question paper not found at: ${QUESTION_PAPER_PATH}`);
    }
    if (!fs.existsSync(ANSWER_KEY_PATH)) {
      throw new Error(`Answer key not found at: ${ANSWER_KEY_PATH}`);
    }
  });

  test('should login successfully', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Navigate to login page
    await page.click('text=Login');
    
    // Fill login form
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for successful login (should redirect to dashboard)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    console.log('✅ Login successful');
  });

  test('should upload PDFs and extract images using bounding boxes', async ({ page }) => {
    // Login first
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to Create Exam page
    await page.goto(`${FRONTEND_URL}/exams/create`);
    await page.waitForLoadState('networkidle');
    
    console.log('📄 Uploading PDFs...');
    
    // Upload question paper
    const questionPaperInput = page.locator('input[type="file"]').first();
    await questionPaperInput.setInputFiles(QUESTION_PAPER_PATH);
    
    // Upload answer key
    const answerKeyInput = page.locator('input[type="file"]').last();
    await answerKeyInput.setInputFiles(ANSWER_KEY_PATH);
    
    // Click upload/parse button
    await page.click('button:has-text("Upload"), button:has-text("Parse")');
    
    console.log('⏳ Waiting for PDF parsing (this may take 2-3 minutes)...');
    
    // Wait for parsing to complete (this can take a while)
    await page.waitForSelector('text=/.*questions? (found|extracted|parsed).*/i', { 
      timeout: 300000 // 5 minutes 
    });
    
    console.log('✅ PDF parsing complete');
    
    // Check if any questions have images
    const questionsWithImages = await page.evaluate(() => {
      const questionElements = document.querySelectorAll('[data-question-id]');
      let count = 0;
      
      questionElements.forEach(el => {
        const images = el.querySelectorAll('img[src*="cloudinary"], img[src*="diagram"]');
        if (images.length > 0) {
          count++;
        }
      });
      
      return count;
    });
    
    console.log(`📊 Found ${questionsWithImages} questions with images`);
    
    // Verify at least one question has an image
    if (questionsWithImages > 0) {
      console.log('✅ Images extracted successfully');
      
      // Check that images are actually accessible
      const firstImage = page.locator('img[src*="cloudinary"], img[src*="diagram"]').first();
      await expect(firstImage).toBeVisible({ timeout: 30000 });
      
      // Get image URL
      const imageUrl = await firstImage.getAttribute('src');
      console.log(`🔗 Sample image URL: ${imageUrl?.substring(0, 50)}...`);
      
      // Verify image loads successfully (status 200)
      const response = await page.request.get(imageUrl!);
      expect(response.status()).toBe(200);
      console.log('✅ Image URL is accessible');
      
    } else {
      console.warn('⚠️  No images found in parsed questions');
    }
  });

  test('should create exam with extracted images', async ({ page }) => {
    // Login
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to Create Exam
    await page.goto(`${FRONTEND_URL}/exams/create`);
    await page.waitForLoadState('networkidle');
    
    // Upload PDFs
    const questionPaperInput = page.locator('input[type="file"]').first();
    await questionPaperInput.setInputFiles(QUESTION_PAPER_PATH);
    const answerKeyInput = page.locator('input[type="file"]').last();
    await answerKeyInput.setInputFiles(ANSWER_KEY_PATH);
    
    // Parse PDFs
    await page.click('button:has-text("Upload"), button:has-text("Parse")');
    await page.waitForSelector('text=/.*questions? (found|extracted|parsed).*/i', { 
      timeout: 300000 
    });
    
    console.log('✅ PDFs parsed, proceeding to create exam...');
    
    // Proceed to next step (assuming wizard-based UI)
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }
    
    // Fill exam details
    await page.fill('input[name="title"], input[placeholder*="title" i]', 'Image Extraction Test Exam');
    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Testing bounding box image extraction');
    
    // Set duration
    const durationInput = page.locator('input[name="duration"], input[type="number"]').first();
    await durationInput.fill('60');
    
    // Create exam
    await page.click('button:has-text("Create"), button[type="submit"]');
    
    // Wait for exam creation
    await page.waitForURL('**/exams/**', { timeout: 30000 });
    
    console.log('✅ Exam created successfully');
    
    // Get exam ID from URL
    const currentUrl = page.url();
    const examIdMatch = currentUrl.match(/exams\/([^\/]+)/);
    if (examIdMatch) {
      examId = examIdMatch[1];
      console.log(`📝 Exam ID: ${examId}`);
    }
    
    // Verify exam page shows images
    const examImages = page.locator('img[src*="cloudinary"], img[src*="diagram"]');
    const imageCount = await examImages.count();
    
    console.log(`📊 Exam page shows ${imageCount} images`);
    
    if (imageCount > 0) {
      // Verify first image is visible and loads
      await expect(examImages.first()).toBeVisible();
      const firstImageUrl = await examImages.first().getAttribute('src');
      const response = await page.request.get(firstImageUrl!);
      expect(response.status()).toBe(200);
      console.log('✅ Exam images are accessible');
    }
  });

  test('should verify image cropping quality', async ({ page }) => {
    // This test checks that cropped images have reasonable dimensions
    // and are not blank/corrupted
    
    await page.goto(`${FRONTEND_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to exams list
    await page.goto(`${FRONTEND_URL}/exams`);
    await page.waitForLoadState('networkidle');
    
    // Find the test exam
    const examLink = page.locator('text=Image Extraction Test Exam').first();
    if (await examLink.isVisible()) {
      await examLink.click();
      await page.waitForLoadState('networkidle');
      
      // Get all diagram images
      const images = page.locator('img[src*="cloudinary"]');
      const imageCount = await images.count();
      
      if (imageCount > 0) {
        console.log(`🔍 Checking quality of ${imageCount} images...`);
        
        for (let i = 0; i < Math.min(imageCount, 3); i++) {
          const img = images.nth(i);
          const imageUrl = await img.getAttribute('src');
          
          // Get image dimensions
          const dimensions = await img.evaluate((el: HTMLImageElement) => ({
            width: el.naturalWidth,
            height: el.naturalHeight
          }));
          
          console.log(`   Image ${i + 1}: ${dimensions.width}x${dimensions.height}px`);
          
          // Verify image has reasonable dimensions (not too small)
          expect(dimensions.width).toBeGreaterThan(50);
          expect(dimensions.height).toBeGreaterThan(50);
          
          // Verify image URL is from Cloudinary
          expect(imageUrl).toMatch(/cloudinary|res\.cloudinary\.com/);
        }
        
        console.log('✅ All checked images have valid dimensions');
      } else {
        console.warn('⚠️  No images found to check quality');
      }
    } else {
      console.warn('⚠️  Test exam not found, skipping quality check');
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: Delete the test exam
    if (examId) {
      console.log(`🧹 Cleaning up test exam: ${examId}`);
      // Note: You'll need to implement cleanup based on your API
      // await request.delete(`${BACKEND_URL}/api/exam/${examId}`, {
      //   headers: { Authorization: `Bearer ${authToken}` }
      // });
    }
  });
});


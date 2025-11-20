const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Exam = require('../models/Exam');
const Question = require('../models/Question');

// Create Express app for testing
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('../routes/auth');
const examRoutes = require('../routes/exam');
const uploadRoutes = require('../routes/upload');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/upload', uploadRoutes);

// Test database URI - use actual MongoDB from .env for testing
const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cbt_platform_test';

// Test credentials
const TEST_USER_EMAIL = 'ps671248@gmail.com';
const TEST_USER_PASSWORD = '12345678@aA';

describe('Create Exam Integration Test', () => {
  let authToken;
  let userId;

  // Setup: Connect to test database
  beforeAll(async () => {
    try {
      await mongoose.connect(TEST_MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000
      });
      console.log('Connected to test database');
    } catch (error) {
      console.error('Failed to connect to test database:', error);
      throw error;
    }
  });

  // Cleanup: Close database connection
  afterAll(async () => {
    await mongoose.connection.close();
    console.log('Closed test database connection');
  });

  // Store created test data for cleanup
  const createdExamIds = [];
  const createdQuestionIds = [];

  // Cleanup test data after tests
  afterEach(async () => {
    // Clean up only test data we created
    if (createdExamIds.length > 0) {
      await Exam.deleteMany({ _id: { $in: createdExamIds } });
      createdExamIds.length = 0;
    }
    if (createdQuestionIds.length > 0) {
      await Question.deleteMany({ _id: { $in: createdQuestionIds } });
      createdQuestionIds.length = 0;
    }
  });

  // Test 1: Login with test credentials
  test('should login with provided credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(TEST_USER_EMAIL);

    // Save token and userId for subsequent tests
    authToken = response.body.token;
    userId = response.body.user.id;

    console.log('✓ Login successful');
  });

  // Test 2: Upload PDFs and parse questions
  test('should upload PDFs and parse questions', async () => {
    // First login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      });

    authToken = loginResponse.body.token;

    // Read PDF files
    const questionPaperPath = path.join(__dirname, '../../uploads/CS12025.pdf');
    const answerKeyPath = path.join(__dirname, '../../uploads/CS1_Keys.pdf');

    const questionPaperExists = await fs.access(questionPaperPath).then(() => true).catch(() => false);
    const answerKeyExists = await fs.access(answerKeyPath).then(() => true).catch(() => false);

    if (!questionPaperExists || !answerKeyExists) {
      console.warn('⚠️  PDF files not found, skipping upload test');
      return;
    }

    // Upload PDFs
    const response = await request(app)
      .post('/api/upload/complete-exam')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('questionPaper', questionPaperPath)
      .attach('answerKey', answerKeyPath)
      .timeout(300000); // 5 minutes timeout for processing

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('questions');
    expect(Array.isArray(response.body.data.questions)).toBe(true);
    expect(response.body.data.questions.length).toBeGreaterThan(0);

    // Verify question structure
    const firstQuestion = response.body.data.questions[0];
    expect(firstQuestion).toHaveProperty('id');
    expect(firstQuestion).toHaveProperty('type');
    expect(firstQuestion).toHaveProperty('text');
    expect(firstQuestion).toHaveProperty('options');
    expect(firstQuestion).toHaveProperty('correct');

    // Check for new images structure
    if (firstQuestion.images) {
      expect(firstQuestion.images).toHaveProperty('question');
      expect(firstQuestion.images).toHaveProperty('options');
      expect(Array.isArray(firstQuestion.images.options)).toBe(true);
    }

    console.log(`✓ PDF parsing successful: ${response.body.data.questions.length} questions extracted`);

    // Count questions with images
    const questionsWithImages = response.body.data.questions.filter(q => {
      return q.images?.question === true || q.images?.options?.some(hasImg => hasImg === true);
    });

    if (questionsWithImages.length > 0) {
      console.log(`✓ Found ${questionsWithImages.length} questions with images`);
    }

    return response.body.data.questions;
  }, 300000); // 5 minutes timeout for PDF processing

  // Test 3: Create exam with parsed questions
  test('should create exam named "gate-test" with parsed questions', async () => {
    // First login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      });

    authToken = loginResponse.body.token;

    // Upload and parse PDFs
    const questionPaperPath = path.join(__dirname, '../../uploads/CS12025.pdf');
    const answerKeyPath = path.join(__dirname, '../../uploads/CS1_Keys.pdf');

    const questionPaperExists = await fs.access(questionPaperPath).then(() => true).catch(() => false);
    const answerKeyExists = await fs.access(answerKeyPath).then(() => true).catch(() => false);

    if (!questionPaperExists || !answerKeyExists) {
      console.warn('⚠️  PDF files not found, skipping exam creation test');
      return;
    }

    const uploadResponse = await request(app)
      .post('/api/upload/complete-exam')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('questionPaper', questionPaperPath)
      .attach('answerKey', answerKeyPath)
      .timeout(300000);

    expect(uploadResponse.status).toBe(200);
    const questions = uploadResponse.body.data.questions;

    // Create exam with parsed questions
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // 7 days from now

    const examData = {
      title: 'gate-test',
      description: 'GATE Computer Science Test - Automated Integration Test',
      settings: {
        duration: 180, // 3 hours
        maxAttempts: 1,
        randomizeQuestions: false,
        showResults: true
      },
      schedule: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      access: {
        type: 'private'
      },
      questions: questions
    };

    const createExamResponse = await request(app)
      .post('/api/exam')
      .set('Authorization', `Bearer ${authToken}`)
      .send(examData)
      .expect(201);

    expect(createExamResponse.body).toHaveProperty('exam');
    expect(createExamResponse.body.exam.title).toBe('gate-test');
    expect(createExamResponse.body.exam.questions.length).toBe(questions.length);

    // Track for cleanup
    createdExamIds.push(createExamResponse.body.exam.id);
    createdQuestionIds.push(...createExamResponse.body.exam.questions.map(q => q._id || q.id));

    console.log(`✓ Exam "gate-test" created successfully with ${questions.length} questions`);
    console.log(`✓ Exam ID: ${createExamResponse.body.exam.id}`);

    // Verify exam in database
    const examInDb = await Exam.findById(createExamResponse.body.exam.id).populate('questions');
    expect(examInDb).toBeTruthy();
    expect(examInDb.title).toBe('gate-test');
    expect(examInDb.questions.length).toBe(questions.length);

    // Verify image URLs if any
    const questionsWithImageUrls = examInDb.questions.filter(q => 
      q.questionImageUrl || (q.optionImages && Object.keys(q.optionImages).length > 0)
    );

    if (questionsWithImageUrls.length > 0) {
      console.log(`✓ ${questionsWithImageUrls.length} questions have uploaded images`);
      
      // Verify at least one image URL is valid
      const firstQuestionWithImage = questionsWithImageUrls[0];
      if (firstQuestionWithImage.questionImageUrl) {
        expect(firstQuestionWithImage.questionImageUrl).toMatch(/^https?:\/\//);
        console.log(`✓ Sample question image URL: ${firstQuestionWithImage.questionImageUrl.substring(0, 50)}...`);
      }
      if (firstQuestionWithImage.optionImages) {
        const optionLabels = Object.keys(firstQuestionWithImage.optionImages);
        if (optionLabels.length > 0) {
          const sampleUrl = firstQuestionWithImage.optionImages[optionLabels[0]];
          expect(sampleUrl).toMatch(/^https?:\/\//);
          console.log(`✓ Sample option image URL: ${sampleUrl.substring(0, 50)}...`);
        }
      }
    }
  }, 300000); // 5 minutes timeout for full flow
});


const request = require('supertest');
const mongoose = require('mongoose');
require('dotenv').config();

// Create Express app for testing
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('../routes/auth');
const examRoutes = require('../routes/exam');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);

// Test database URI
const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cbt_platform_test';

// Test credentials
const TEST_USER_EMAIL = 'ps671248@gmail.com';
const TEST_USER_PASSWORD = '12345678@aA';

describe('Generate Questions Integration Test', () => {
  let authToken;

  // Setup: Connect to test database
  beforeAll(async () => {
    try {
      await mongoose.connect(TEST_MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
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

  // Test 1: Login
  test('should login with provided credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      })
      .expect(200);

    authToken = response.body.token;
    console.log('✓ Login successful');
  });

  // Test 2: Generate Questions
  test('should generate questions using AI', async () => {
    if (!authToken) {
      console.warn('Skipping test due to login failure');
      return;
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
      console.warn('⚠️ GEMINI_API_KEY not configured, skipping AI generation test');
      return;
    }

    const response = await request(app)
      .post('/api/exam/generate-questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        topic: 'Solar System',
        subject: 'Science',
        grade: 'Grade 5',
        count: 3,
        type: 'mcq_single',
        difficulty: 30,
        specificNeeds: 'Include a question about Mars'
      })
      .timeout(60000); // 1 minute timeout for AI

    if (response.status !== 200) {
      console.error('API Error Status:', response.status);
      console.error('API Error Body:', JSON.stringify(response.body, null, 2));
    }

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('questions');
    expect(Array.isArray(response.body.questions)).toBe(true);
    expect(response.body.questions.length).toBe(3);

    const firstQuestion = response.body.questions[0];
    expect(firstQuestion).toHaveProperty('text');
    expect(firstQuestion).toHaveProperty('options');
    expect(firstQuestion).toHaveProperty('correct');
    
    console.log(`✓ Generated ${response.body.questions.length} questions successfully`);
    console.log('Sample Question:', firstQuestion.text);
  }, 60000);

  // Test 3: Validation Error
  test('should fail with invalid parameters', async () => {
    if (!authToken) return;

    const response = await request(app)
      .post('/api/exam/generate-questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        topic: '', // Missing topic
        subject: 'Science',
        grade: 'Grade 5',
        count: 55 // Invalid count
      });

    expect(response.status).toBe(400);
    console.log('✓ Validation check passed');
  });
});

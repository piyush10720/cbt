const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { authenticate } = require('../middleware/auth');
const geminiParser = require('../services/geminiParser');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// All routes require authentication
router.use(authenticate);

// Upload and parse question paper
router.post('/question-paper', upload.single('questionPaper'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded'
      });
    }

    // Read and parse PDF
    const pdfBuffer = await fs.readFile(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        message: 'Could not extract text from PDF. Please ensure the PDF contains readable text.'
      });
    }

    // Parse with Gemini
    const parseResult = await geminiParser.parseQuestionPaper(extractedText);

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn('Failed to delete uploaded file:', unlinkError);
    }

    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Failed to parse question paper',
        error: parseResult.error,
        extractedText: extractedText.substring(0, 500) + '...' // First 500 chars for debugging
      });
    }

    res.json({
      message: 'Question paper parsed successfully',
      data: {
        questions: parseResult.questions,
        totalQuestions: parseResult.totalQuestions,
        extractedText: extractedText.substring(0, 1000) + '...', // First 1000 chars for review
        metadata: parseResult.metadata
      }
    });

  } catch (error) {
    console.error('Question paper upload error:', error);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Failed to delete uploaded file after error:', unlinkError);
      }
    }

    res.status(500).json({
      message: 'Failed to process question paper',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Upload and parse answer key
router.post('/answer-key', upload.single('answerKey'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded'
      });
    }

    const { questions } = req.body;
    let existingQuestions = [];

    if (questions) {
      try {
        existingQuestions = JSON.parse(questions);
      } catch (parseError) {
        return res.status(400).json({
          message: 'Invalid questions format'
        });
      }
    }

    // Read and parse PDF
    const pdfBuffer = await fs.readFile(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        message: 'Could not extract text from answer key PDF'
      });
    }

    // Parse with Gemini
    const parseResult = await geminiParser.parseAnswerKey(extractedText, existingQuestions);

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn('Failed to delete uploaded file:', unlinkError);
    }

    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Failed to parse answer key',
        error: parseResult.error,
        extractedText: extractedText.substring(0, 500) + '...'
      });
    }

    res.json({
      message: 'Answer key parsed successfully',
      data: {
        questions: parseResult.questions,
        alignedCount: parseResult.alignedCount,
        extractedText: extractedText.substring(0, 1000) + '...',
        metadata: parseResult.metadata
      }
    });

  } catch (error) {
    console.error('Answer key upload error:', error);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Failed to delete uploaded file after error:', unlinkError);
      }
    }

    res.status(500).json({
      message: 'Failed to process answer key',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Upload both question paper and answer key together
router.post('/complete-exam', upload.fields([
  { name: 'questionPaper', maxCount: 1 },
  { name: 'answerKey', maxCount: 1 }
]), async (req, res) => {
  try {
    const questionPaperFile = req.files['questionPaper']?.[0];
    const answerKeyFile = req.files['answerKey']?.[0];

    if (!questionPaperFile) {
      return res.status(400).json({
        message: 'Question paper is required'
      });
    }

    // Read PDF files as buffers
    const questionPaperBuffer = await fs.readFile(questionPaperFile.path);
    const answerKeyBuffer = answerKeyFile ? await fs.readFile(answerKeyFile.path) : null;

    // Send PDF buffers directly to Gemini
    geminiParser.lastPdfBuffer = questionPaperBuffer;
    const parserResponse = await geminiParser.parseQuestionPaper(questionPaperBuffer, answerKeyBuffer);

    // Clean up uploaded files
    try {
      await fs.unlink(questionPaperFile.path);
      if (answerKeyFile) {
        await fs.unlink(answerKeyFile.path);
      }
    } catch (unlinkError) {
      console.warn('Failed to delete uploaded files:', unlinkError);
    }

    res.json({
      message: 'Exam files parsed successfully',
      data: {
        questions: parserResponse.questions,
        totalQuestions: parserResponse.totalQuestions,
        metadata: parserResponse.metadata
      }
    });

  } catch (error) {
    console.error('Complete exam upload error:', error);
    
    // Clean up files if they exist
    if (req.files) {
      const allFiles = [
        ...(req.files['questionPaper'] || []),
        ...(req.files['answerKey'] || [])
      ];
      
      for (const file of allFiles) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.warn('Failed to delete uploaded file after error:', unlinkError);
        }
      }
    }

    res.status(500).json({
      message: 'Failed to process exam files',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test Gemini connection
router.get('/test-gemini', async (req, res) => {
  try {
    const testResult = await geminiParser.testConnection();
    res.json(testResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      message: 'Only PDF files are allowed.'
    });
  }

  next(error);
});

module.exports = router;

const express = require('express');
const {
  submitAnswer,
  getExamProgress,
  submitExam,
  getResult,
  getUserResults,
  addCheatingFlag,
  explainAnswer,
  submitAnswerValidation
} = require('../controllers/resultController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Exam taking routes
router.post('/:resultId/answer', submitAnswerValidation, submitAnswer);
router.get('/:resultId/progress', getExamProgress);
router.post('/:resultId/submit', submitExam);
router.post('/:resultId/cheating-flag', addCheatingFlag);
router.post('/:resultId/explain', explainAnswer);

// Result viewing routes
router.get('/:resultId', getResult);
router.get('/', getUserResults);

module.exports = router;

const express = require('express');
const {
  submitAnswer,
  getExamProgress,
  submitExam,
  getResult,
  getUserResults,
  getExamResults,
  addCheatingFlag,
  explainAnswer,
  submitAnswerValidation,
  gradeResult
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
router.put('/:resultId/grade', gradeResult);

// Result viewing routes
router.get('/exam/:examId/attempts', getExamResults); // Get all attempts for an exam (creator/admin only)
router.get('/:resultId', getResult);
router.get('/', getUserResults);

module.exports = router;

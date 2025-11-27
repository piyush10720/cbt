const express = require('express');
const {
  createExam,
  getExams,
  getExamById,
  updateExam,
  publishExam,
  unpublishExam,
  deleteExam,
  startExam,
  mergeExams,

  createExamValidation,
  generateInviteCode,
  revokeInviteCode,
  generateInviteLink,
  revokeInviteLink,
  addUserToExam,
  removeUserFromExam
} = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Public exam routes (for all authenticated users)
router.get('/', getExams);
router.get('/:id', getExamById);
router.post('/:id/start', startExam);

// Teacher/Admin only routes
router.post('/merge', authorize('teacher', 'admin'), mergeExams);
router.post('/', authorize('teacher', 'admin'), createExamValidation, createExam);
router.put('/:id', authorize('teacher', 'admin'), updateExam);
router.post('/:id/publish', authorize('teacher', 'admin'), publishExam);
router.post('/:id/unpublish', authorize('teacher', 'admin'), unpublishExam);
router.delete('/:id', authorize('teacher', 'admin'), deleteExam);

// Invite system routes
router.post('/:id/invite-code', authorize('teacher', 'admin'), generateInviteCode);
router.delete('/:id/invite-code', authorize('teacher', 'admin'), revokeInviteCode);
router.post('/:id/invite-link', authorize('teacher', 'admin'), generateInviteLink);
router.delete('/:id/invite-link', authorize('teacher', 'admin'), revokeInviteLink);
router.post('/:id/users/add', authorize('teacher', 'admin'), addUserToExam);
router.post('/:id/users/remove', authorize('teacher', 'admin'), removeUserFromExam);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  toggleBookmark,
  getBookmarks,
  getBookmarkFolders,
  getBookmark,
  updateBookmark,
  deleteBookmark,
  checkBookmarks
} = require('../controllers/bookmarkController');

// All routes require authentication
router.use(authenticate);

// Toggle bookmark (create or delete)
router.post('/toggle', toggleBookmark);

// Get all bookmarks
router.get('/', getBookmarks);

// Get bookmark folders
router.get('/folders', getBookmarkFolders);

// Check bookmarks for a result
router.get('/check/:resultId', checkBookmarks);

// Get single bookmark
router.get('/:id', getBookmark);

// Update bookmark
router.put('/:id', updateBookmark);

// Delete bookmark
router.delete('/:id', deleteBookmark);

module.exports = router;


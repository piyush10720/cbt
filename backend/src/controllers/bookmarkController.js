const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const Result = require('../models/Result');

// Create/Toggle bookmark
const toggleBookmark = async (req, res) => {
  try {
    const { questionId, resultId } = req.body;
    const userId = req.user.id;

    if (!questionId || !resultId) {
      return res.status(400).json({
        message: 'Question ID and Result ID are required'
      });
    }

    // Check if bookmark already exists
    const existingBookmark = await Bookmark.findOne({
      userId,
      questionId,
      resultId
    });

    if (existingBookmark) {
      // Remove bookmark
      await Bookmark.findByIdAndDelete(existingBookmark._id);
      return res.json({
        message: 'Bookmark removed successfully',
        bookmarked: false
      });
    }

    // Get result details to populate bookmark
    const result = await Result.findById(resultId)
      .populate('examId')
      .populate('answers.questionId');

    if (!result) {
      return res.status(404).json({
        message: 'Result not found'
      });
    }

    // Check if user owns this result
    if (result.userId.toString() !== userId) {
      return res.status(403).json({
        message: 'Access denied'
      });
    }

    // Find the specific answer for this question
    const answer = result.answers.find(
      ans => ans.questionId._id.toString() === questionId
    );

    if (!answer) {
      return res.status(404).json({
        message: 'Question not found in result'
      });
    }

    const question = answer.questionId;

    // Create new bookmark
    const bookmark = new Bookmark({
      userId,
      questionId,
      examId: result.examId._id,
      examTitle: result.examId.title,
      resultId,
      questionText: question.text,
      questionType: question.type,
      userAnswer: answer.userAnswer,
      correctAnswer: question.correct,
      isCorrect: answer.isCorrect,
      marksAwarded: answer.marksAwarded
    });

    await bookmark.save();

    res.status(201).json({
      message: 'Bookmark created successfully',
      bookmarked: true,
      bookmark
    });

  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

// Get all bookmarks for a user
const getBookmarks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { examId, search, sortBy = 'createdAt', order = 'desc' } = req.query;

    // Build query
    const query = { userId };
    
    if (examId) {
      query.examId = examId;
    }

    if (search) {
      query.$or = [
        { questionText: { $regex: search, $options: 'i' } },
        { examTitle: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const bookmarks = await Bookmark.find(query)
      .populate('questionId', 'text type options correct marks difficulty subject topic')
      .populate('examId', 'title description settings')
      .sort(sortOptions);

    res.json({
      bookmarks,
      count: bookmarks.length
    });

  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

// Get bookmarks grouped by exam (folders)
const getBookmarkFolders = async (req, res) => {
  try {
    const userId = req.user.id;

    const folders = await Bookmark.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$examId',
          examTitle: { $first: '$examTitle' },
          count: { $sum: 1 },
          lastBookmarked: { $max: '$createdAt' }
        }
      },
      { $sort: { lastBookmarked: -1 } }
    ]);

    // Get total count
    const totalCount = await Bookmark.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });

    res.json({
      folders: [
        {
          _id: 'all',
          examTitle: 'All Bookmarks',
          count: totalCount,
          lastBookmarked: folders.length > 0 ? folders[0].lastBookmarked : null
        },
        ...folders
      ]
    });

  } catch (error) {
    console.error('Get bookmark folders error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

// Get bookmark by ID
const getBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookmark = await Bookmark.findOne({ _id: id, userId })
      .populate('questionId')
      .populate('examId')
      .populate('resultId');

    if (!bookmark) {
      return res.status(404).json({
        message: 'Bookmark not found'
      });
    }

    res.json({ bookmark });

  } catch (error) {
    console.error('Get bookmark error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

// Update bookmark (notes/tags)
const updateBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { notes, tags } = req.body;

    const bookmark = await Bookmark.findOne({ _id: id, userId });

    if (!bookmark) {
      return res.status(404).json({
        message: 'Bookmark not found'
      });
    }

    if (notes !== undefined) {
      bookmark.notes = notes;
    }
    if (tags !== undefined) {
      bookmark.tags = tags;
    }

    await bookmark.save();

    res.json({
      message: 'Bookmark updated successfully',
      bookmark
    });

  } catch (error) {
    console.error('Update bookmark error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

// Delete bookmark
const deleteBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bookmark = await Bookmark.findOneAndDelete({ _id: id, userId });

    if (!bookmark) {
      return res.status(404).json({
        message: 'Bookmark not found'
      });
    }

    res.json({
      message: 'Bookmark deleted successfully'
    });

  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

// Check if questions are bookmarked
const checkBookmarks = async (req, res) => {
  try {
    const { resultId } = req.params;
    const userId = req.user.id;

    const bookmarks = await Bookmark.find({ userId, resultId }).select('questionId notes');
    
    const bookmarkedQuestions = bookmarks.map(b => ({
      questionId: b.questionId.toString(),
      bookmarkId: b._id,
      notes: b.notes
    }));

    res.json({
      bookmarkedQuestions
    });

  } catch (error) {
    console.error('Check bookmarks error:', error);
    res.status(500).json({
      message: error.message || 'Internal server error'
    });
  }
};

module.exports = {
  toggleBookmark,
  getBookmarks,
  getBookmarkFolders,
  getBookmark,
  updateBookmark,
  deleteBookmark,
  checkBookmarks
};


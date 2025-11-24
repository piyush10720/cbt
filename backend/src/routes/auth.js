const express = require('express');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  registerValidation,
  loginValidation,
  updateProfileValidation
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', updateProfileValidation, updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logout);

// Get multiple users by IDs (for folder invited users list)
router.post('/users/details', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    const User = require('../models/User');
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email profilePicture createdAt')
      .lean();

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

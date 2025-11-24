const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/temp-images');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'diagram-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  }
});

// All routes require authentication
router.use(authenticate);

// Upload diagram image
router.post('/diagram', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No image file uploaded'
      });
    }

    const { type = 'question', questionId, optionLabel } = req.body;

    console.log('Uploading diagram:', { type, questionId, optionLabel, filename: req.file.filename });

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'cbt-diagrams',
      resource_type: 'image',
      public_id: type === 'option' 
        ? `question_${questionId}_option_${optionLabel}_${Date.now()}`
        : `question_${questionId}_${Date.now()}`,
      overwrite: true,
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    // Clean up temporary file
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn('Failed to delete temporary file:', unlinkError);
    }

    const imageUrl = result.secure_url || result.url;

    res.json({
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        type: type,
        questionId: questionId,
        optionLabel: optionLabel
      }
    });

  } catch (error) {
    console.error('Image upload error:', error);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Failed to delete temporary file after error:', unlinkError);
      }
    }

    res.status(500).json({
      message: 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Upload diagram from base64 (fallback method)
router.post('/diagram-base64', async (req, res) => {
  try {
    const { base64Data, type = 'question', questionId, optionLabel } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        message: 'No image data provided'
      });
    }

    console.log('Uploading diagram from base64:', { type, questionId, optionLabel });

    // Ensure base64 has proper data URI prefix
    let dataUri = base64Data;
    if (!base64Data.startsWith('data:')) {
      dataUri = `data:image/png;base64,${base64Data}`;
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'cbt-diagrams',
      resource_type: 'image',
      public_id: type === 'option' 
        ? `question_${questionId}_option_${optionLabel}_${Date.now()}`
        : `question_${questionId}_${Date.now()}`,
      overwrite: true,
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    const imageUrl = result.secure_url || result.url;

    res.json({
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        type: type,
        questionId: questionId,
        optionLabel: optionLabel
      }
    });

  } catch (error) {
    console.error('Base64 image upload error:', error);

    res.status(500).json({
      message: 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'Image too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      message: 'Only image files are allowed.'
    });
  }

  next(error);
});

module.exports = router;


const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const resultRoutes = require('./routes/result');
const uploadRoutes = require('./routes/upload');
const debugRoutes = require('./routes/debug');
const bookmarkRoutes = require('./routes/bookmarks');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cbt_platform';

const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS ?? '10000', 10),
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS ?? '45000', 10)
    });

    console.log('MongoDB connected successfully');
    startServer();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error(`Failed to connect to MongoDB at ${MONGO_URI}. Ensure the database is running and accessible.`);
    process.exit(1);
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err);
});

const startServer = () => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/result', resultRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/bookmarks', bookmarkRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

connectToDatabase();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const router = express.Router();

// Allow all origins for PDF proxy (needed for react-pdf)
router.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));

/**
 * PDF Proxy Route
 * Serves PDFs from Cloudinary with proper CORS headers
 * This solves CORS issues when loading PDFs in react-pdf
 */

router.get('/pdf/view', async (req, res) => {
  try {
    const { url } = req.query;
    
    console.log('PDF Proxy Request:', { url, query: req.query });
    
    if (!url) {
      console.error('PDF Proxy Error: No URL provided');
      return res.status(400).json({ message: 'PDF URL is required' });
    }

    // Validate that it's a Cloudinary URL
    if (!url.includes('cloudinary.com')) {
      console.error('PDF Proxy Error: Invalid URL', url);
      return res.status(400).json({ message: 'Invalid PDF URL - must be from Cloudinary' });
    }

    console.log('Fetching PDF from Cloudinary:', url);

    // Fetch the PDF from Cloudinary with extended timeout and retries
    let response;
    let retries = 3;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          timeout: 90000, // 90 seconds for large PDFs
          maxContentLength: 50 * 1024 * 1024, // 50MB max
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
          headers: {
            'User-Agent': 'CBT-Platform-Proxy/1.0',
            'Accept': 'application/pdf'
          },
          // Handle connection resets
          httpsAgent: require('https').Agent({
            rejectUnauthorized: false,
            keepAlive: true
          })
        });
        
        // Success!
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt}/${retries} failed:`, error.code || error.message);
        
        if (attempt < retries && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET')) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        // All retries exhausted
        throw error;
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to fetch PDF after retries');
    }

    if (response.status !== 200) {
      console.error('Cloudinary returned non-200 status:', response.status);
      return res.status(response.status).json({ 
        message: 'Failed to fetch PDF from Cloudinary',
        status: response.status
      });
    }

    console.log('PDF fetched successfully, streaming to client');

    // Set content type headers (CORS already handled by middleware)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Handle range requests for PDF streaming
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    // Stream the PDF
    response.data.pipe(res);

    response.data.on('error', (streamError) => {
      console.error('Stream error:', streamError);
    });

  } catch (error) {
    console.error('PDF proxy error:', error.message);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.status
    });
    
    res.status(500).json({ 
      message: 'Failed to fetch PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        responseStatus: error.response?.status
      } : undefined
    });
  }
});

// Test endpoint to verify proxy is working
router.get('/test', (req, res) => {
  res.json({
    message: 'PDF Proxy is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;


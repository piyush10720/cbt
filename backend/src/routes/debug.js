const express = require('express');
const geminiParser = require('../services/geminiParser');

const router = express.Router();

// Debug endpoint to test text parsing
router.post('/parse-text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('=== DEBUG PARSING ===');
    console.log(`Input text length: ${text.length}`);
    console.log(`First 200 chars: ${text.substring(0, 200)}`);
    
    // Force basic text parsing
    const result = geminiParser.basicTextParsing(text);
    
    console.log(`Parsed ${result.length} questions`);
    console.log('=== END DEBUG ===');
    
    res.json({
      success: true,
      questionsFound: result.length,
      questions: result.slice(0, 5), // Return first 5 for debugging
      textLength: text.length,
      firstChars: text.substring(0, 200)
    });
    
  } catch (error) {
    console.error('Debug parsing error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

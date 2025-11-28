const axios = require('axios');

/**
 * GeminiCreator class to handle the generation of exam questions
 * using the Gemini AI API in a Node.js environment.
 */
class GeminiCreator {
  constructor() {
    // Get API keys from environment variables (comma-separated or JSON array)
    const rawKeys = process.env.GEMINI_API_KEY;
    this.apiKeys = [];
    
    if (rawKeys) {
      if (rawKeys.startsWith('[') && rawKeys.endsWith(']')) {
        try {
          this.apiKeys = JSON.parse(rawKeys);
        } catch (e) {
          console.warn('Failed to parse GEMINI_API_KEY as JSON, treating as string');
          this.apiKeys = [rawKeys];
        }
      } else {
        this.apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
      }
    }
    
    this.currentKeyIndex = 0;
    
    // Use cheaper model for text generation
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    
    this.requestTimeout = parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS, 10) || 120000; // 2 minutes
    
    if (this.apiKeys.length === 0) {
      console.warn('GEMINI_API_KEY not found in environment variables');
    } else {
      console.log(`Loaded ${this.apiKeys.length} Gemini API keys`);
    }
  }

  /**
   * Get the next API key in round-robin fashion
   * @returns {string} - The API key to use
   */
  getNextApiKey() {
    if (this.apiKeys.length === 0) {
      return null;
    }
    
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * Generates exam questions based on the provided prompt parameters.
   *
   * @param {Object} params - The parameters for question generation.
   * @param {string} params.topic - The topic of the exam.
   * @param {string} params.subject - The subject of the exam.
   * @param {string} params.grade - The grade or level of the exam.
   * @param {number} params.count - The number of questions to generate.
   * @param {string} params.type - The type of questions (e.g., 'mcq_single', 'true_false').
   * @param {number} params.difficulty - The difficulty level (1-100).
   * @param {string} [params.specificNeeds] - Any specific needs or instructions.
   * @returns {Promise<Array>} - A promise that resolves to an array of generated questions.
   */

  /**
   * Generates exam questions based on the provided prompt parameters.
   * Handles batching for large counts to avoid token limits and ensure uniqueness.
   *
   * @param {Object} params - The parameters for question generation.
   * @returns {Promise<Array>} - A promise that resolves to an array of generated questions.
   */
  async generateQuestionsFromPrompt(params) {
    const { count } = params;
    const BATCH_SIZE = 10;

    // If count is small, just run a single batch
    if (count <= BATCH_SIZE) {
      return this._generateSingleBatch(params);
    }

    // For larger counts, use parallel batching with over-generation
    console.log(`🚀 Starting parallel generation for ${count} questions...`);
    
    // Over-generate by 20% to account for duplicates
    const targetWithBuffer = Math.ceil(count * 1.2);
    const numBatches = Math.ceil(targetWithBuffer / BATCH_SIZE);
    
    console.log(`Planning ${numBatches} batches of ~${BATCH_SIZE} questions each.`);

    const batchPromises = [];
    for (let i = 0; i < numBatches; i++) {
      // Calculate count for this batch (distribute evenly or just max out)
      const batchCount = (i === numBatches - 1) 
        ? targetWithBuffer - (i * BATCH_SIZE) 
        : BATCH_SIZE;

      if (batchCount <= 0) continue;

      // Add a small delay between starting batches to avoid instant rate limiting if any
      const delay = i * 500; 
      
      batchPromises.push(new Promise(resolve => {
        setTimeout(() => {
          this._generateSingleBatch({ ...params, count: batchCount })
            .then(questions => resolve(questions))
            .catch(err => {
              console.error(`Batch ${i+1} failed:`, err.message);
              resolve([]); // Return empty array on failure to allow other batches to succeed
            });
        }, delay);
      }));
    }

    // Wait for all batches
    const results = await Promise.all(batchPromises);
    let allQuestions = results.flat();
    
    console.log(`Raw generated count: ${allQuestions.length}`);

    // De-duplicate
    allQuestions = this._filterSemanticDuplicates(allQuestions);
    console.log(`Count after de-duplication: ${allQuestions.length}`);

    // Top-up if needed
    if (allQuestions.length < count) {
      const needed = count - allQuestions.length;
      console.log(`⚠️ Short by ${needed} questions. Running top-up batch...`);
      
      // Create negative constraints from existing questions
      const existingTopics = allQuestions
        .map(q => q.text.substring(0, 50)) // Use first 50 chars as "topic" proxy
        .slice(0, 20) // Limit to avoid huge prompt
        .join('; ');
        
      const topUpParams = {
        ...params,
        count: Math.ceil(needed * 1.5), // Over-generate slightly for top-up too
        specificNeeds: `${params.specificNeeds || ''}. IMPORTANT: Do NOT repeat questions similar to: ${existingTopics}`
      };

      try {
        const topUpQuestions = await this._generateSingleBatch(topUpParams);
        const uniqueTopUp = this._filterSemanticDuplicates([...allQuestions, ...topUpQuestions]);
        allQuestions = uniqueTopUp;
      } catch (err) {
        console.error('Top-up batch failed:', err);
      }
    }

    // Return exactly the requested amount (or as many as we have)
    return allQuestions.slice(0, count);
  }

  /**
   * Internal method to generate a single batch of questions.
   * @param {Object} params 
   * @returns {Promise<Array>}
   */
  async _generateSingleBatch({ topic, subject, grade, count, type, difficulty, specificNeeds }) {
    if (this.apiKeys.length === 0 || this.apiKeys[0] === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your environment variables.');
    }

    // Map difficulty (1-100) to a descriptive string
    let difficultyDesc = 'Medium';
    if (difficulty <= 30) difficultyDesc = 'Easy';
    else if (difficulty >= 70) difficultyDesc = 'Hard';
    
    // Construct the prompt
    const prompt = `
      You are an expert exam question generator. Create ${count} ${type} questions for a ${subject} exam on the topic "${topic}".
      Target Audience: Grade/Level ${grade}.
      Difficulty Level: ${difficulty}/100 (${difficultyDesc}).
      ${specificNeeds ? `Specific Instructions: ${specificNeeds}` : ''}

      Return the output strictly as a JSON array of question objects.
      
      JSON Schema for each question (must match exactly):
      {
        "id": "generated_q1", // unique placeholder id
        "type": "${type}", // must match requested type: mcq_single, mcq_multi, true_false, numeric, descriptive
        "text": "Question text here... (use LaTeX for math, e.g., $x^2$)",
        "options": [
          { "label": "A", "text": "Option A text" },
          { "label": "B", "text": "Option B text" },
          { "label": "C", "text": "Option C text" },
          { "label": "D", "text": "Option D text" }
        ],
        "correct": ["A"], // Array of correct option labels. For numeric, it's the value ["42.5"]
        "marks": 1,
        "negative_marks": 0, // Default to 0
        "explanation": "Brief explanation of the correct answer.",
        "difficulty": "${difficultyDesc.toLowerCase()}",
        "topic": "${topic}",
        "subject": "${subject}",
        "tags": ["${topic}", "${subject}", "${grade}"],
        "images": {
            "question": false,
            "options": [false, false, false, false]
        }
      }

      For True/False questions, options should be "True" and "False".
      For Numeric questions, "options" should be empty [], and "correct" should contain the numeric answer as a string (e.g., ["42.5"]).
      
      Ensure the JSON is valid and properly escaped. Do not include any markdown formatting (like \`\`\`json) in the response, just the raw JSON array.
    `;

    try {
      console.log(`🤖 Generating ${count} questions on "${topic}" using Gemini...`);
      console.log(`Using model: ${this.model}`);

      const response = await axios.post(
        this.baseUrl,
        {
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.getNextApiKey()
          },
          timeout: this.requestTimeout
        }
      );

      if (!response.data.candidates || response.data.candidates.length === 0) {
        console.error('Gemini Response:', JSON.stringify(response.data, null, 2));
        throw new Error('No valid response from Gemini API.');
      }

      const rawText = response.data.candidates[0].content.parts[0].text;
      console.log('Gemini Raw Response Length:', rawText.length);
      return this.parseGeminiResponse(rawText);

    } catch (error) {
      console.error('Gemini Generation Error:', error.response?.data || error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
      }
      throw error;
    }
  }

  /**
   * Filters out semantically similar questions using Jaccard Similarity.
   * @param {Array} questions 
   * @returns {Array} Unique questions
   */
  _filterSemanticDuplicates(questions) {
    const uniqueQuestions = [];
    const SIMILARITY_THRESHOLD = 0.6; // 60% overlap means duplicate

    for (const q of questions) {
      let isDuplicate = false;
      for (const uniqueQ of uniqueQuestions) {
        const similarity = this._calculateJaccardSimilarity(q.text, uniqueQ.text);
        if (similarity > SIMILARITY_THRESHOLD) {
          isDuplicate = true;
          // console.log(`Duplicate found: "${q.text.substring(0, 30)}..." vs "${uniqueQ.text.substring(0, 30)}..." (${similarity.toFixed(2)})`);
          break;
        }
      }
      if (!isDuplicate) {
        uniqueQuestions.push(q);
      }
    }
    return uniqueQuestions;
  }

  /**
   * Calculates Jaccard Similarity between two strings.
   * Intersection of words / Union of words.
   * @param {string} str1 
   * @param {string} str2 
   * @returns {number} 0 to 1
   */
  _calculateJaccardSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const tokenize = (text) => {
      const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'what', 'where', 'how', 'why', 'who', 'to', 'from', 'in', 'of', 'for', 'with', 'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among']);
      return new Set(
        text.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove punctuation
          .split(/\s+/)
          .filter(word => word.length > 2 && !stopWords.has(word))
      );
    };

    const set1 = tokenize(str1);
    const set2 = tokenize(str2);

    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Parses the raw text response from Gemini into a JSON array.
   * @param {string} response - The raw text response.
   * @returns {Array} - The parsed array of questions.
   */
  parseGeminiResponse(response) {
    try {
      // Clean up markdown code fences
      let cleanResponse = response.trim();
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find JSON array
      const startIndex = cleanResponse.indexOf('[');
      const endIndex = cleanResponse.lastIndexOf(']');
      
      if (startIndex === -1 || endIndex === -1) {
        throw new Error('No JSON array found in response');
      }
      
      const jsonString = cleanResponse.substring(startIndex, endIndex + 1);
      
      let questions;
      try {
        // First attempt: direct parse
        questions = JSON.parse(jsonString);
      } catch (parseError) {
        console.warn('⚠️  Initial JSON parse failed, attempting fixes...');
        
        // Strategy 1: Fix all unescaped backslashes (common in LaTeX)
        try {
          // Match any backslash NOT followed by a valid JSON escape sequence
          // Valid: \" \\ \/ \b \f \n \r \t \uXXXX
          let fixedJson = jsonString.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
          questions = JSON.parse(fixedJson);
          console.log('✓ Fixed with backslash escaping');
        } catch (e1) {
          // Strategy 2: Try using JSON5 or manual string parsing
          try {
            // More aggressive approach: escape ALL backslashes first, then parse
            let fixedJson = jsonString.replace(/\\/g, '\\\\');
            // Then un-escape the ones that were already correctly escaped
            fixedJson = fixedJson
              .replace(/\\\\\\\\/g, '\\\\')  // \\\\ -> \\
              .replace(/\\\\"/g, '\\"')       // \\" -> \"
              .replace(/\\\\n/g, '\\n')       // \\n -> \n
              .replace(/\\\\r/g, '\\r')       // \\r -> \r
              .replace(/\\\\t/g, '\\t')       // \\t -> \t
              .replace(/\\\\\//g, '\\/')      // \\/ -> \/
              .replace(/\\\\b/g, '\\b')       // \\b -> \b
              .replace(/\\\\f/g, '\\f');      // \\f -> \f
            questions = JSON.parse(fixedJson);
            console.log('✓ Fixed with aggressive backslash normalization');
          } catch (e2) {
            // Strategy 3: Manual field-by-field parsing with regex
            try {
              // Last resort: try to fix the specific problematic area
              let fixedJson = jsonString
                .replace(/\\n/g, '\\\\n')  // Fix literal \n
                .replace(/\\t/g, '\\\\t')  // Fix literal \t
                .replace(/\\r/g, '\\\\r')  // Fix literal \r
                .replace(/\\sum/g, '\\\\sum')  // Common LaTeX commands
                .replace(/\\prod/g, '\\\\prod')
                .replace(/\\int/g, '\\\\int')
                .replace(/\\frac/g, '\\\\frac')
                .replace(/\\sqrt/g, '\\\\sqrt')
                .replace(/\\begin/g, '\\\\begin')
                .replace(/\\end/g, '\\\\end');
              
              questions = JSON.parse(fixedJson);
              console.log('✓ Fixed with LaTeX command escaping');
            } catch (e3) {
              console.error('All JSON parsing strategies failed');
              throw parseError;
            }
          }
        }
      }
      
      if (!Array.isArray(questions)) {
        throw new Error('Parsed response is not an array');
      }
      
      // Post-process questions to ensure they have unique IDs
      return questions.map((q, index) => ({
        ...q,
        id: `gen_${Date.now()}_${index}`,
        // Ensure options are in the correct format (object with label/text)
        options: q.options.map(opt => {
            if (typeof opt === 'string') {
                return { label: opt, text: opt };
            }
            return opt;
        })
      }));
      
    } catch (error) {
      console.error('Failed to parse generated questions:', error);
      throw new Error('Failed to parse AI response. Please try again.');
    }
  }
}

module.exports = new GeminiCreator();

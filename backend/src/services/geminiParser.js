const axios = require('axios')
const cloudinary = require('cloudinary').v2
const { splitPdfIntoChunks, extractSpecificPages } = require('../utils/pdf')
const imageCropper = require('../utils/imageCropper')

/**
 * GeminiParser class to handle the parsing of question paper and answer key PDFs
 * using the Gemini AI API in a Node.js environment.
 */
class GeminiParser {
  constructor() {
    // Get API key from environment variables
    this.apiKey = process.env.GEMINI_API_KEY;
    
    // Use cheaper model for text extraction (Phase 1)
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    
    // Use stable model for image extraction (Phase 2)
    // gemini-1.5-flash has better quota limits and is more stable
    this.visionModel = process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash';
    this.visionBaseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.visionModel}:generateContent`;
    
    this.requestTimeout = parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS, 10) || 360000;
    
    // Set up a base delay for exponential backoff in case of rate limiting.
    this.baseDelay = 2000; // 2 seconds
    this.maxRetries = 3;
    
    this.lastPdfBuffer = null

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    if (!this.apiKey) {
      console.warn('GEMINI_API_KEY not found in environment variables');
    }
  }

  /**
   * Main method to parse question paper and optional answer key PDFs.
   *
   * @param {Buffer} questionPaperBuffer - The binary content of the question paper PDF.
   * @param {Buffer} [answerKeyBuffer=null] - The binary content of the answer key PDF.
   * @returns {Promise<Object>} - A promise that resolves to a structured object containing the parsed questions.
   */
  async parseQuestionPaper(questionPaperBuffer, answerKeyBuffer = null) {
    if (!this.apiKey || this.apiKey === 'your-gemini-api-key-here') {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your environment variables.');
    }

    if (!questionPaperBuffer) {
      throw new Error('Question paper buffer is required.');
    }
    
    console.log(`🚀 Starting PDF processing:`)
    console.log(`   📝 Phase 1 (text extraction): ${this.model}`)
    console.log(`   🎨 Phase 2 (image extraction): ${this.visionModel}`)
    console.log(`   📄 Question paper: ${Math.round(questionPaperBuffer.length / 1024)}KB, Answer key: ${answerKeyBuffer ? Math.round(answerKeyBuffer.length / 1024) : 0}KB`);
    
    try {
      // PHASE 1: Extract questions with image metadata
      const chunks = await splitPdfIntoChunks(questionPaperBuffer, {
        pagesPerChunk: parseInt(process.env.GEMINI_PAGES_PER_CHUNK ?? '5', 10)
      })

      let allQuestions = []

      for (const [chunkIndex, chunk] of chunks.entries()) {
        console.log(`🧩 Processing chunk ${chunkIndex + 1}/${chunks.length} (pages ${chunk.startPage}-${chunk.endPage})`)
        console.log(`   📄 Sending to Gemini: ${Math.round(chunk.buffer.length / 1024)}KB (${chunk.endPage - chunk.startPage + 1} pages only)`)
        this.lastPdfBuffer = chunk.buffer
        const responseText = await this.callGeminiAPIWithFiles(chunk.buffer, answerKeyBuffer, chunk.startPage)
        const questions = await this.parseGeminiResponse(responseText, {
          pageOffset: chunk.startPage - 1,
          chunkPageRange: { start: chunk.startPage, end: chunk.endPage }
        })
        allQuestions = allQuestions.concat(questions)
      }

      console.log(`✅ Phase 1 complete: ${allQuestions.length} questions parsed`)

      // PHASE 2: Extract images for questions that have them
      const questionsWithImages = allQuestions.filter(q => {
        const hasQuestionImage = q.images?.question === true
        const hasOptionImages = q.images?.options && q.images.options.some(hasImg => hasImg === true)
        return hasQuestionImage || hasOptionImages
      })

      if (questionsWithImages.length > 0) {
        console.log(`📸 Found ${questionsWithImages.length} question(s) with images`)
        
        // OPTIMIZATION: Extract only specific pages where questions with images are located
        // Collect unique page numbers for questions with images
        const uniquePages = new Set()
        questionsWithImages.forEach(q => {
          if (q._estimatedPage) {
            uniquePages.add(q._estimatedPage)
          }
        })
        
        const sortedPages = Array.from(uniquePages).sort((a, b) => a - b)
        
        if (sortedPages.length > 0) {
          console.log(`📄 Optimizing Phase 2: Extracting only ${sortedPages.length} specific pages (pages: ${sortedPages.join(', ')})`)
          
          // Batch pages by 5 for efficient processing
          const pagesPerBatch = 5
          const numBatches = Math.ceil(sortedPages.length / pagesPerBatch)
          
          for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
            const batchPages = sortedPages.slice(batchIdx * pagesPerBatch, (batchIdx + 1) * pagesPerBatch)
            
            // Get questions on these pages
            const questionsInBatch = questionsWithImages.filter(q => 
              batchPages.includes(q._estimatedPage)
            )
            
            try {
              console.log(`\n📦 Batch ${batchIdx + 1}/${numBatches}: Extracting ${batchPages.length} pages (${batchPages.join(', ')})`)
              
              // Extract only these specific pages
              const extracted = await extractSpecificPages(questionPaperBuffer, batchPages)
              console.log(`   ✂️  ${extracted.extractedPageCount} pages → ${Math.round(extracted.buffer.length / 1024)}KB (${questionsInBatch.length} questions)`)
              
              // Process images for questions on these pages
              await this.extractImagesForQuestions(extracted.buffer, questionsInBatch)
            } catch (error) {
              console.warn(`   ⚠️  Batch ${batchIdx + 1} failed, skipping:`, error.message)
            }
          }
        } else {
          // Fallback if no page info
          console.log(`   ⚠️  No page info available, sending full PDF (${Math.round(questionPaperBuffer.length / 1024)}KB)`)
          await this.extractImagesForQuestions(questionPaperBuffer, questionsWithImages)
        }
      }

      // Transform questions to ensure proper diagram structure for options
      const transformedQuestions = allQuestions.map(q => {
        // Transform options array to include diagram data if optionImages exist
        if (q.optionImages && Object.keys(q.optionImages).length > 0) {
          q.options = q.options.map(opt => {
            const optionLabel = typeof opt === 'string' ? opt : opt.label
            const optionText = typeof opt === 'string' ? opt : opt.text
            
            if (q.optionImages[optionLabel]) {
              return {
                label: optionLabel,
                text: optionText,
                diagram: {
                  present: true,
                  url: q.optionImages[optionLabel],
                  description: `Option ${optionLabel} diagram`,
                  uploaded_at: new Date().toISOString()
                }
              }
            }
            
            // Return as object format for consistency
            return typeof opt === 'string' ? { label: opt, text: opt } : opt
          })
          
          // Clean up temporary optionImages field
          delete q.optionImages
        }
        
        return q
      })

      return {
        success: true,
        questions: transformedQuestions,
        totalQuestions: transformedQuestions.length,
        metadata: {
          parsedAt: new Date().toISOString(),
          hasAnswerKey: !!answerKeyBuffer,
          source: 'gemini',
          questionsWithImages: questionsWithImages.length
        }
      }
    } catch (error) {
      console.error('An error occurred during parsing:', error.message);
      return {
        success: false,
        questions: [],
        totalQuestions: 0,
        metadata: {
          parsedAt: new Date().toISOString(),
          hasAnswerKey: !!answerKeyBuffer,
          source: 'gemini'
        },
        error: error.message
      };
    } finally {
      this.lastPdfBuffer = null
    }
  }

  /**
   * Calls the Gemini API with the provided file buffers and handles retries.
   *
   * @param {Buffer} questionPaperBuffer
   * @param {Buffer} [answerKeyBuffer=null]
   * @param {number} [retryCount=0]
   * @returns {Promise<string>} - A promise that resolves to the raw text content from the Gemini response.
   */
  async callGeminiAPIWithFiles(questionPaperBuffer, answerKeyBuffer = null, startPage = 1, retryCount = 0) {
    try {
      const pageOffsetNote = startPage > 1 
        ? `\n\nIMPORTANT: This PDF chunk starts at page ${startPage} of the original document. When identifying page numbers, add ${startPage - 1} to the local page number. For example, if a question is on page 1 of this chunk, set pageNumber to ${startPage}.`
        : '';
      
      const parts = [
        {
          text: `You are an exam parsing assistant. Analyse the uploaded PDF files and return a structured JSON array.

Requirements:
- Identify every question in reading order.
- For each question, note which PDF page number it appears on in the ORIGINAL FULL DOCUMENT.${pageOffsetNote}
- Supported types: mcq_single, mcq_multi, true_false, numeric, descriptive.
- Extract question text verbatim (include any text that IS present, even if there's also an image/diagram).
- Each question must include an "options" array with label and text for each option.
- For questions/options that contain images or diagrams, indicate their presence in the "images" field:
  {
    "question": true/false,  // Does the question itself contain an image/diagram?
    "options": [false, true, false, false]  // Which options contain images? (array matches option order)
  }
- If an answer key PDF is provided, align the correct option labels in "correct".
- PRESERVE MATHEMATICAL NOTATION EXACTLY AS IT APPEARS:
  * Extract ALL LaTeX commands with backslashes: \\times, \\Sigma, \\alpha, \\sqrt, \\frac, \\begin, \\end, etc.
  * Preserve matrix notation: \\begin{bmatrix}...\\end{bmatrix}, \\begin{pmatrix}...\\end{pmatrix}
  * Keep special math symbols as-is if no LaTeX: Σ, α, β, π, ∑, ∫, ∞, ≤, ≥, ×, etc.
  * Keep all mathematical expressions in their original format
- CRITICAL JSON ESCAPING RULES:
  * Every backslash MUST be doubled in JSON strings
  * \\times → \\\\times in JSON
  * \\Sigma → \\\\Sigma in JSON  
  * \\begin{bmatrix} → \\\\begin{bmatrix} in JSON
  * Quotes: \\" 
  * Newlines: \\n
  * EXAMPLE: Raw text "$\\times$" MUST be written as "$\\\\times$" in JSON
  * EXAMPLE: Raw text "\\begin{bmatrix}" MUST be written as "\\\\begin{bmatrix}" in JSON

Return ONLY a JSON array where every question follows the appropriate schema based on type:

For MCQ questions (mcq_single, mcq_multi):
{
  "id": "q1",
  "type": "mcq_single",
  "text": "Let $A$ be a $2 \\\\times 2$ matrix. What are the eigenvalues of $A^{13}$?",
  "pageNumber": 1,
  "options": [
    { "label": "A", "text": "$\\\\lambda = 1, -1$" },
    { "label": "B", "text": "$\\\\lambda^{13} = 1$" },
    { "label": "C", "text": "Option C text" },
    { "label": "D", "text": "Option D text" }
  ],
  "correct": ["A"],
  "marks": 1,
  "negative_marks": 0,
  "images": {
    "question": false,
    "options": [false, false, false, false]
  }
}

For questions with matrices:
{
  "id": "q2",
  "type": "mcq_single",
  "text": "Given the matrix $$A = \\\\begin{bmatrix} 1 & 2 \\\\\\\\ 3 & 4 \\\\end{bmatrix}$$ find its determinant.",
  "pageNumber": 2,
  "options": [
    { "label": "A", "text": "-2" },
    { "label": "B", "text": "2" },
    { "label": "C", "text": "0" },
    { "label": "D", "text": "10" }
  ],
  "correct": ["A"],
  "marks": 2,
  "negative_marks": 0
}

For True/False questions:
{
  "id": "q2",
  "type": "true_false",
  "text": "Question text here...",
  "pageNumber": 1,
  "options": [
    { "label": "True", "text": "True" },
    { "label": "False", "text": "False" }
  ],
  "correct": ["True"],
  "marks": 1,
  "negative_marks": 0
}

For Numeric questions:
{
  "id": "q3",
  "type": "numeric",
  "text": "Question text here...",
  "pageNumber": 1,
  "options": [],
  "correct": ["42.5"],
  "marks": 2,
  "negative_marks": 0,
  "images": {
    "question": false
  }
}

For Descriptive questions:
{
  "id": "q4",
  "type": "descriptive",
  "text": "Question text here...",
  "pageNumber": 1,
  "options": [],
  "correct": [""],
  "marks": 5,
  "negative_marks": 0
}`
        },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: questionPaperBuffer.toString('base64')
          }
        }
      ];

      // Add answer key PDF if provided
      if (answerKeyBuffer) {
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: answerKeyBuffer.toString('base64')
          }
        });
      }

      console.log(`🤖 Sending PDFs to Gemini for processing (using ${this.model})...`);
      
      const response = await axios.post(
        this.baseUrl,
        {
          contents: [{
            role: 'user',
            parts: parts
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          timeout: this.requestTimeout, // Allow longer processing time for large PDFs
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      console.log(`🛰️ Gemini response status: ${response.status}`);

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No valid response from Gemini API.');
      }

      return response.data.candidates[0].content.parts[0].text;
      
    } catch (error) {
      const status = error.response?.status

      if ((status === 429 || status === 503) && retryCount < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, retryCount);
        const reason = status === 429 ? 'rate limited' : 'model overloaded'
        console.log(`⏱️ Gemini ${reason}. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callGeminiAPIWithFiles(questionPaperBuffer, answerKeyBuffer, startPage, retryCount + 1);
      }
      
      // Handle other specific errors
      if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes. Consider upgrading to a paid plan for higher limits.');
      } else if (status === 503) {
        throw new Error('Gemini model is currently overloaded. Please retry shortly.');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Invalid API key. Please check your Gemini API key configuration.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid request format. The PDF files might be corrupted or too large.');
      } else if (error.response?.status === 404) {
        throw new Error(`Requested Gemini model "${this.model}" was not found or does not support generateContent. Update GEMINI_MODEL or verify the model is available.`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error(`Gemini request timed out after ${this.requestTimeout / 1000}s. Try reducing PDF size or increase GEMINI_REQUEST_TIMEOUT_MS.`);
      }
      
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Parses the raw text response from the Gemini API and extracts the JSON array.
   *
   * @param {string} response - The raw text content from the API.
   * @param {Object} options - Parsing options
   * @param {number} options.pageOffset - Page offset for this chunk
   * @param {Object} options.chunkPageRange - Page range for this chunk
   * @returns {Array} - The parsed JSON array of questions.
   */
  async parseGeminiResponse(response, { pageOffset = 0, chunkPageRange = null } = {}) {
    try {
      // Clean up potential markdown code fences and whitespace.
      let cleanResponse = response.trim();
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Use string search to find the JSON array and parse it.
      const startIndex = cleanResponse.indexOf('[');
      const endIndex = cleanResponse.lastIndexOf(']');
      
      if (startIndex === -1 || endIndex === -1) {
        throw new Error('No JSON array found in Gemini response');
      }
      
      let jsonString = cleanResponse.substring(startIndex, endIndex + 1);
      
      // Try parsing with different strategies
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
              // Extract error position and show more context
              const errorPos = parseError.message.match(/position (\d+)/);
              const pos = errorPos ? parseInt(errorPos[1]) : 3069;
              console.error('Error at position:', pos);
              console.error('Problematic JSON section:', jsonString.substring(Math.max(0, pos - 150), Math.min(jsonString.length, pos + 150)));
              
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
        throw new Error('Gemini response is not a valid array');
      }

      // Add page number metadata to questions for Phase 2 optimization
      if (chunkPageRange) {
        questions.forEach((q, index) => {
          // Use Gemini-provided page number if available
          if (q.pageNumber && typeof q.pageNumber === 'number') {
            // Adjust for chunk offset (Gemini returns page relative to chunk)
            q.sourcePageNumber = q.pageNumber
            q._estimatedPage = q.pageNumber
          } else {
            // Fallback: Distribute questions evenly across the chunk's page range
            const pagesInChunk = chunkPageRange.end - chunkPageRange.start + 1
            const estimatedPageOffset = Math.floor((index / questions.length) * pagesInChunk)
            q._estimatedPage = chunkPageRange.start + estimatedPageOffset
            q.sourcePageNumber = chunkPageRange.start + estimatedPageOffset
          }
          q._pageRange = chunkPageRange // Keep for fallback
          
          // Clean up temporary pageNumber field
          delete q.pageNumber
        })
      } else {
        // No chunk info, use Gemini page numbers directly
        questions.forEach((q) => {
          if (q.pageNumber && typeof q.pageNumber === 'number') {
            q.sourcePageNumber = q.pageNumber
            q._estimatedPage = q.pageNumber
            delete q.pageNumber
          }
        })
      }
 
      return questions;
      
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.log('Raw response (first 1000 chars):', response.substring(0, 1000));
      throw error;
    }
  }

  /**
   * Test Gemini API connection
   */
  async testConnection() {
    try {
      if (!this.apiKey || this.apiKey === 'your-gemini-api-key-here') {
        return { success: false, error: 'API key not configured' };
      }

      const response = await axios.post(
        this.baseUrl,
        {
          contents: [{
            role: 'user',
            parts: [{
              text: 'Say "Hello" in JSON format: {"message": "Hello"}'
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          timeout: Math.min(this.requestTimeout, 10000)
        }
      );

      return { success: true, response: response.data.candidates[0].content.parts[0].text.substring(0, 100) };
    } catch (error) {
      if (error.response?.status === 429) {
        return { success: false, error: 'Rate limit exceeded. Please wait a few minutes before testing again.' };
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        return { success: false, error: 'Invalid API key. Please check your configuration.' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract images as base64 from PDF for questions that have images
   * Phase 2 of the two-phase image extraction process
   * 
   * @param {Buffer} pdfBuffer - The PDF buffer containing the images
   * @param {Array} questionsWithImages - Questions that have images metadata
   * @returns {Promise<void>} - Updates questions in place with image URLs
   */
  async extractImagesForQuestions(pdfBuffer, questionsWithImages) {
    if (!questionsWithImages || questionsWithImages.length === 0) {
      console.log('✓ No images to extract')
      return
    }

    if (!cloudinary.config().cloud_name) {
      console.warn('⚠️  Cloudinary configuration missing. Skipping image extraction.')
      return
    }

    const folder = process.env.CLOUDINARY_FOLDER || 'cbt-diagrams'
    const batchSize = 10
    const batches = []

    // Split into batches of 10
    for (let i = 0; i < questionsWithImages.length; i += batchSize) {
      batches.push(questionsWithImages.slice(i, i + batchSize))
    }

    console.log(`\n🎨 Extracting images for ${questionsWithImages.length} question(s) in ${batches.length} batch(es)...`)
    console.log(`   📌 Using NEW METHOD: Bounding Box + Cropping`)

    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} questions)`)

      try {
        // Build request for this batch
        const imageRequests = batch.map(q => {
          const request = { 
            questionId: q.id,
            pageNumber: q.pageNumber || 1 // Include page number for context
          }
          if (q.images?.question) {
            request.extractQuestionImage = true
          }
          if (q.images?.options && q.images.options.some(hasImg => hasImg)) {
            request.extractOptionImages = q.options
              .map((opt, idx) => q.images.options[idx] ? opt.label : null)
              .filter(label => label !== null)
          }
          return request
        })

        // Call Gemini to get bounding boxes (NEW METHOD)
        const boundingBoxData = await this.requestImageBoundingBoxes(pdfBuffer, imageRequests)

        // Process each question and crop images based on bounding boxes
        for (const question of batch) {
          const boxData = boundingBoxData[question.id]
          if (!boxData) {
            console.warn(`   ⚠️  No bounding box data found for question ${question.id}`)
            continue
          }

          // Process question image if present
          if (boxData.question && boxData.question.boundingBox) {
            try {
              const page = boxData.question.page || question.pageNumber || 1
              console.log(`   🎯 Processing question ${question.id} image from page ${page}`)
              
              // Convert PDF page to image
              const pageImage = await imageCropper.convertPdfPageToImage(pdfBuffer, page)
              
              // Crop the image using the bounding box
              const croppedImage = await imageCropper.cropImage(pageImage, boxData.question.boundingBox)
              
              // Convert buffer to base64 for upload
              const base64Data = croppedImage.toString('base64')
              
              // Upload to Cloudinary
              const identifier = `question_${question.id}`
              const url = await this.uploadBase64ToCloudinary(base64Data, identifier, folder)
              
              if (url) {
                question.questionImageUrl = url // Legacy field
                question.diagram = {
                  present: true,
                  url: url,
                  page: page,
                  description: 'Extracted diagram from PDF',
                  uploaded_at: new Date().toISOString()
                }
                console.log(`   ✅ Question ${question.id} image uploaded`)
                console.log(`   🔗 URL: ${url}`)
              }
            } catch (error) {
              console.error(`   ❌ Failed to process question ${question.id} image:`, error.message)
              
              // Fallback to old method if cropping fails
              console.log(`   🔄 Attempting fallback to legacy base64 method...`)
              try {
                const fallbackRequest = [{
                  questionId: question.id,
                  extractQuestionImage: true
                }]
                const fallbackData = await this.requestBase64Images(pdfBuffer, fallbackRequest)
                if (fallbackData[question.id]?.question) {
                  const url = await this.uploadBase64ToCloudinary(
                    fallbackData[question.id].question,
                    `question_${question.id}`,
                    folder
                  )
                  if (url) {
                    question.questionImageUrl = url // Legacy field
                    question.diagram = {
                      present: true,
                      url: url,
                      description: 'Extracted diagram from PDF (fallback method)',
                      uploaded_at: new Date().toISOString()
                    }
                    console.log(`   ✅ Question ${question.id} image uploaded (via fallback)`)
                  }
                }
              } catch (fallbackError) {
                console.error(`   ❌ Fallback also failed for question ${question.id}`)
              }
            }
          }

          // Process option images if present
          if (boxData.options) {
            if (!question.optionImages) {
              question.optionImages = {}
            }
            
            for (const [optionLabel, optionData] of Object.entries(boxData.options)) {
              if (!optionData.boundingBox) {
                console.warn(`   ⚠️  No bounding box for question ${question.id} option ${optionLabel}`)
                continue
              }
              
              try {
                const page = optionData.page || question.pageNumber || 1
                console.log(`   🎯 Processing question ${question.id} option ${optionLabel} from page ${page}`)
                
                // Convert PDF page to image (will be cached if same page)
                const pageImage = await imageCropper.convertPdfPageToImage(pdfBuffer, page)
                
                // Crop the option image
                const croppedImage = await imageCropper.cropImage(pageImage, optionData.boundingBox)
                
                // Convert to base64
                const base64Data = croppedImage.toString('base64')
                
                // Upload to Cloudinary
                const identifier = `question_${question.id}_option_${optionLabel}`
                const url = await this.uploadBase64ToCloudinary(base64Data, identifier, folder)
                
                if (url) {
                  question.optionImages[optionLabel] = url
                  console.log(`   ✅ Question ${question.id} option ${optionLabel} image uploaded`)
                  console.log(`   🔗 URL: ${url}`)
                }
              } catch (error) {
                console.error(`   ❌ Failed to process question ${question.id} option ${optionLabel}:`, error.message)
              }
            }
          }
        }
      } catch (error) {
        console.error(`   ❌ Failed to process batch ${batchIndex + 1}:`, error.message)
        console.error(`   Stack trace:`, error.stack)
      }
    }

    console.log(`\n✅ Image extraction complete`)
  }

  /**
   * Request bounding boxes from Gemini for images in the PDF
   * NEW METHOD: Uses bounding boxes + cropping instead of direct base64
   * 
   * @param {Buffer} pdfBuffer - The PDF buffer
   * @param {Array} imageRequests - Array of image requests per question
   * @returns {Promise<Object>} - Map of questionId to bounding box data
   */
  async requestImageBoundingBoxes(pdfBuffer, imageRequests, retryCount = 0) {
    try {
      const requestDetails = imageRequests.map(req => {
        const parts = [`Question ID: ${req.questionId}, Page: ${req.pageNumber || 1}`]
        if (req.extractQuestionImage) parts.push('- Locate the question image/diagram')
        if (req.extractOptionImages && req.extractOptionImages.length > 0) {
          parts.push(`- Locate option images for: ${req.extractOptionImages.join(', ')}`)
        }
        return parts.join('\n')
      }).join('\n\n')

      const parts = [
        {
          text: `TASK: Identify precise bounding boxes for images/diagrams in this PDF.

You have vision capabilities. Use them to:
1. CAREFULLY EXAMINE each page of the PDF
2. IDENTIFY images, diagrams, charts, graphs, and figures
3. DETERMINE the exact rectangular region containing each image
4. RETURN bounding box coordinates as normalized values (0.0 to 1.0)

Questions needing image locations:
${requestDetails}

Your response must be ONLY valid JSON (no markdown, no explanations):
{
  "q5": {
    "question": {
      "page": 1,
      "boundingBox": {
        "x": 0.1,
        "y": 0.2,
        "width": 0.5,
        "height": 0.3
      }
    }
  },
  "q7": {
    "options": {
      "B": {
        "page": 1,
        "boundingBox": {
          "x": 0.1,
          "y": 0.5,
          "width": 0.4,
          "height": 0.2
        }
      }
    }
  }
}

CRITICAL RULES:
1. Normalized coordinates (0.0 to 1.0):
   - x: horizontal position from LEFT edge (0 = left, 1 = right)
   - y: vertical position from TOP edge (0 = top, 1 = bottom)
   - width: width as fraction of page width (0.1 = 10% of page width)
   - height: height as fraction of page height (0.1 = 10% of page height)

2. Include small margins (5-10% padding) around images to ensure complete capture

3. For diagrams/figures that span multiple lines or have captions:
   - Include the entire visual element INCLUDING captions and labels
   - Ensure no part of the diagram is cut off

4. Be PRECISE - measure coordinates carefully from page edges

5. If you cannot locate an image, omit that field entirely (don't guess)

6. Return ONLY valid JSON - NO markdown code fences, NO explanations, NO comments

7. Double-check all coordinate values are between 0.0 and 1.0

Return bounding boxes now:`
        },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBuffer.toString('base64')
          }
        }
      ]

      console.log(`   🤖 Requesting bounding boxes from Gemini (using ${this.visionModel})...`)

      const response = await axios.post(
        this.visionBaseUrl,
        {
          contents: [{
            role: 'user',
            parts: parts
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          timeout: this.requestTimeout,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      )

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No valid response from Gemini API.')
      }

      const responseText = response.data.candidates[0].content.parts[0].text
      
      console.log('   📄 Gemini response length:', responseText.length, 'chars')
      
      // Parse JSON response
      let cleanResponse = responseText.trim()
      
      // Remove markdown code fences
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.substring(7).trim()
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.substring(3).trim()
      }
      
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3).trim()
      }
      
      // Find JSON object boundaries
      const startIndex = cleanResponse.indexOf('{')
      const endIndex = cleanResponse.lastIndexOf('}')
      
      if (startIndex === -1 || endIndex === -1) {
        console.warn('   ⚠️  Could not find complete JSON object - skipping this batch')
        return {}
      }
      
      const jsonString = cleanResponse.substring(startIndex, endIndex + 1)
      
      let boundingBoxData
      try {
        boundingBoxData = JSON.parse(jsonString)
      } catch (parseError) {
        console.warn('   ⚠️  JSON parse failed:', parseError.message)
        console.warn('   Sample JSON (first 500 chars):', jsonString.substring(0, 500))
        return {}
      }
      
      console.log(`   ✓ Successfully parsed bounding boxes for ${Object.keys(boundingBoxData).length} question(s)`)
      
      return boundingBoxData

    } catch (error) {
      const status = error.response?.status

      if ((status === 429 || status === 503) && retryCount < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, retryCount)
        console.log(`   ⏱️  Retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.requestImageBoundingBoxes(pdfBuffer, imageRequests, retryCount + 1)
      }

      console.error('Gemini bounding box error:', error.response?.data || error.message)
      throw error
    }
  }

  /**
   * Request base64 encoded images from Gemini for specific questions
   * LEGACY METHOD: Kept for backward compatibility
   * 
   * @param {Buffer} pdfBuffer - The PDF buffer
   * @param {Array} imageRequests - Array of image requests per question
   * @returns {Promise<Object>} - Map of questionId to base64 image data
   */
  async requestBase64Images(pdfBuffer, imageRequests, retryCount = 0) {
    try {
      const requestDetails = imageRequests.map(req => {
        const parts = [`Question ID: ${req.questionId}`]
        if (req.extractQuestionImage) parts.push('- Extract the question image/diagram')
        if (req.extractOptionImages && req.extractOptionImages.length > 0) {
          parts.push(`- Extract option images for: ${req.extractOptionImages.join(', ')}`)
        }
        return parts.join('\n')
      }).join('\n\n')

      const parts = [
        {
          text: `TASK: Convert images/diagrams from this PDF to base64-encoded PNG images.

You have vision capabilities. Use them to:
1. SEE the images/diagrams in the PDF
2. CONVERT each image you see into a PNG file
3. ENCODE that PNG file as base64
4. RETURN the complete base64 string in JSON

Questions needing images:
${requestDetails}

EXAMPLE OF REAL BASE64 (first 100 chars):
"iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHw..."

Your response must be ONLY this JSON (with FULL base64 strings, not truncated):
{
  "q5": {
    "question": "iVBORw0KGgoAAAANSUhE..." (FULL base64 - should be 10,000+ characters)
  },
  "q7": {
    "options": {
      "B": "iVBORw0KGgoAAAANSUhE..." (FULL base64 - should be 10,000+ characters)
    }
  }
}

RULES:
- Return COMPLETE base64 strings (minimum 5000 characters each)
- Must start with "iVBORw0KGgo" or "/9j/" for PNG/JPEG
- NO placeholder text like "base64_encoded_image_data"
- NO truncation like "..."
- If you can't generate the image, omit that field entirely
- Valid JSON only, no markdown

Generate the images now and encode them as base64:`
        },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBuffer.toString('base64')
          }
        }
      ]

      console.log(`   🤖 Requesting base64 images from Gemini (using ${this.visionModel})...`)

      const response = await axios.post(
        this.visionBaseUrl,  // Use vision model for image extraction
        {
          contents: [{
            role: 'user',
            parts: parts
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          timeout: this.requestTimeout,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      )

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No valid response from Gemini API.')
      }

      const responseText = response.data.candidates[0].content.parts[0].text
      
      console.log('   📄 Gemini response length:', responseText.length, 'chars')
      
      // Log response preview for debugging
      if (responseText.length < 2000) {
        console.log('   📝 Full response:', responseText)
      } else {
        console.log('   📝 Response preview (first 500 chars):', responseText.substring(0, 500))
        console.log('   📝 Response preview (last 200 chars):', responseText.substring(responseText.length - 200))
      }
      
      // Parse JSON response - remove markdown code fences more aggressively
      let cleanResponse = responseText.trim()
      
      // Remove opening code fence
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.substring(7).trim()
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.substring(3).trim()
      }
      
      // Remove closing code fence
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3).trim()
      }
      
      // Find JSON object boundaries
      const startIndex = cleanResponse.indexOf('{')
      const endIndex = cleanResponse.lastIndexOf('}')
      
      if (startIndex === -1 || endIndex === -1) {
        console.warn('   ⚠️  Could not find complete JSON object - skipping image extraction for this batch')
        return {}
      }
      
      let jsonString = cleanResponse.substring(startIndex, endIndex + 1)
      
      // Apply the same robust JSON parsing strategies as parseGeminiResponse
      let imageData
      try {
        // First attempt: direct parse
        imageData = JSON.parse(jsonString)
      } catch (parseError) {
        console.warn('   ⚠️  Initial JSON parse failed, attempting fixes...')
        
        // Strategy 1: Fix all unescaped backslashes (common in LaTeX/base64)
        try {
          let fixedJson = jsonString.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
          imageData = JSON.parse(fixedJson)
          console.log('   ✓ Fixed with backslash escaping')
        } catch (e1) {
          // Strategy 2: More aggressive backslash fixing
          try {
            let fixedJson = jsonString.replace(/\\/g, '\\\\')
            fixedJson = fixedJson
              .replace(/\\\\\\\\/g, '\\\\')
              .replace(/\\\\"/g, '\\"')
              .replace(/\\\\n/g, '\\n')
              .replace(/\\\\r/g, '\\r')
              .replace(/\\\\t/g, '\\t')
              .replace(/\\\\\//g, '\\/')
              .replace(/\\\\b/g, '\\b')
              .replace(/\\\\f/g, '\\f')
            imageData = JSON.parse(fixedJson)
            console.log('   ✓ Fixed with aggressive backslash normalization')
          } catch (e2) {
            console.warn(`   ⚠️  All JSON parsing strategies failed - skipping image extraction for this batch`)
            console.warn(`   Error: ${parseError.message}`)
            console.warn(`   Sample JSON (first 500 chars):`, jsonString.substring(0, 500))
            return {}
          }
        }
      }
      
      // Validate and log parsed data
      console.log(`   ✓ Successfully parsed image data for ${Object.keys(imageData).length} question(s)`)
      
      // Check if we got real base64 data or empty/placeholder responses
      let validImages = 0
      let emptyImages = 0
      let placeholderImages = 0
      
      for (const [qId, data] of Object.entries(imageData)) {
        if (data.question) {
          if (data.question.length < 100 || data.question.includes('base64_encoded_image_data')) {
            placeholderImages++
            console.warn(`   ⚠️  Question ${qId}: Got placeholder/invalid data (length: ${data.question.length})`)
          } else {
            validImages++
            console.log(`   ✓ Question ${qId}: Valid base64 image (${data.question.length} chars, starts with: ${data.question.substring(0, 20)}...)`)
          }
        }
        
        if (data.options) {
          for (const [opt, base64] of Object.entries(data.options)) {
            if (base64.length < 100 || base64.includes('base64_encoded_image_data')) {
              placeholderImages++
              console.warn(`   ⚠️  Question ${qId} option ${opt}: Got placeholder/invalid data (length: ${base64.length})`)
            } else {
              validImages++
              console.log(`   ✓ Question ${qId} option ${opt}: Valid base64 image (${base64.length} chars)`)
            }
          }
        }
        
        // Check for empty objects
        if (!data.question && !data.options) {
          emptyImages++
          console.warn(`   ⚠️  Question ${qId}: Empty object (no images returned)`)
        }
      }
      
      console.log(`   📊 Image extraction summary: ${validImages} valid, ${emptyImages} empty, ${placeholderImages} placeholders`)
      
      return imageData

    } catch (error) {
      const status = error.response?.status

      if ((status === 429 || status === 503) && retryCount < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, retryCount)
        console.log(`   ⏱️  Retrying in ${delay}ms... (attempt ${retryCount + 1}/${this.maxRetries})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.requestBase64Images(pdfBuffer, imageRequests, retryCount + 1)
      }

      console.error('Gemini image extraction error:', error.response?.data || error.message)
      throw error
    }
  }

  /**
   * Upload base64 image to Cloudinary
   * 
   * @param {string} base64Data - Base64 encoded image data
   * @param {string} identifier - Unique identifier for the image
   * @param {string} folder - Cloudinary folder
   * @returns {Promise<string|null>} - Cloudinary URL or null on failure
   */
  async uploadBase64ToCloudinary(base64Data, identifier, folder) {
    try {
      // Ensure base64 has proper data URI prefix
      let dataUri = base64Data
      if (!base64Data.startsWith('data:')) {
        dataUri = `data:image/png;base64,${base64Data}`
      }

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder,
            public_id: identifier,
            overwrite: true,
            resource_type: 'image'
      })

      return uploadResult.secure_url || uploadResult.url
    } catch (error) {
      console.error(`   ❌ Failed to upload ${identifier}:`, error.message)
      return null
    }
  }
}

// Export the instance
module.exports = new GeminiParser();



const axios = require('axios')
const cloudinary = require('cloudinary').v2
const { renderPdfToPng, cropBoundingBox, splitPdfIntoChunks } = require('../utils/pdf')

const DEFAULT_PDF_DENSITY = parseInt(process.env.PDF_RENDER_DPI ?? '220', 10)

/**
 * GeminiParser class to handle the parsing of question paper and answer key PDFs
 * using the Gemini AI API in a Node.js environment.
 */
class GeminiParser {
  constructor() {
    // Get API key from environment variables
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
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
    
    console.log(`🚀 Sending PDFs to Gemini (${this.model}) - Question paper: ${questionPaperBuffer.length} bytes, Answer key: ${answerKeyBuffer ? answerKeyBuffer.length : 0} bytes`);
    
    try {
      const chunks = await splitPdfIntoChunks(questionPaperBuffer, {
        pagesPerChunk: parseInt(process.env.GEMINI_PAGES_PER_CHUNK ?? '5', 10)
      })

      let allQuestions = []

      for (const [chunkIndex, chunk] of chunks.entries()) {
        console.log(`🧩 Processing chunk ${chunkIndex + 1}/${chunks.length} (pages ${chunk.startPage}-${chunk.endPage})`)
        this.lastPdfBuffer = chunk.buffer
        const responseText = await this.callGeminiAPIWithFiles(chunk.buffer, answerKeyBuffer)
        const questions = await this.parseGeminiResponse(responseText, {
          pageOffset: chunk.startPage - 1
        })
        allQuestions = allQuestions.concat(questions)
      }

      console.log(`✅ Gemini returned ${allQuestions.length} questions across ${chunks.length} chunk(s)`)

      return {
        success: true,
        questions: allQuestions,
        totalQuestions: allQuestions.length,
        metadata: {
          parsedAt: new Date().toISOString(),
          hasAnswerKey: !!answerKeyBuffer,
          source: 'gemini'
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
  async callGeminiAPIWithFiles(questionPaperBuffer, answerKeyBuffer = null, retryCount = 0) {
    try {
      const parts = [
        {
          text: `You are an exam parsing assistant. Analyse the uploaded PDF files and return a structured JSON array.

Requirements:
- Identify every question in reading order.
- Supported types: mcq_single, mcq_multi, true_false, numeric, descriptive.
- Extract question text verbatim.
- Each question must include an "options" array. For each option provide:
  {
    "label": "A",
    "text": "Optional text (can be empty if purely graphical)",
    "diagram": {
      "present": true|false,
      "page": number,
      "page_width": number,
      "page_height": number,
      "bounding_box": { "x": number, "y": number, "width": number, "height": number },
      "description": "short neutral description"
    }
  }
- Detect question-level diagrams too, using the same structure under a "diagram" field.
- If a diagram or option image is not clearly visible, set present=false.
- If an answer key PDF is provided, align the correct option labels in "correct".
- Do not fabricate diagrams or coordinates. If unsure, set present=false.
- Preserve mathematical notation exactly.

Return ONLY a JSON array where every question follows this schema:
{
  "id": "q1",
  "type": "mcq_single",
  "text": "...",
  "options": [ ... ],
  "correct": ["A"],
  "marks": 1,
  "negative_marks": 0,
  "diagram": { ... }
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

      console.log('🤖 Sending PDFs to Gemini for processing...');
      
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
        return this.callGeminiAPIWithFiles(questionPaperBuffer, answerKeyBuffer, retryCount + 1);
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
   * @returns {Array} - The parsed JSON array of questions.
   */
  async parseGeminiResponse(response, { pageOffset = 0 } = {}) {
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
      
      const jsonString = cleanResponse.substring(startIndex, endIndex + 1);
      const questions = JSON.parse(jsonString);
      
      if (!Array.isArray(questions)) {
        throw new Error('Gemini response is not a valid array');
      }

      await this.processDiagrams(questions, { pageOffset })
 
      return questions;
      
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.log('Raw response:', response.substring(0, 500));
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

  async processDiagrams(questions, { pageOffset = 0 } = {}) {
    if (!questions || questions.length === 0) return

    if (!cloudinary.config().cloud_name) {
      console.warn('Cloudinary configuration missing. Skipping diagram upload.')
      return
    }

    if (!this.lastPdfBuffer) {
      console.warn('Original PDF buffer not available for diagram cropping.')
      return
    }

    const folder = process.env.CLOUDINARY_FOLDER || 'cbt-diagrams'

    const pageCache = new Map()
    const tasks = []

    const enqueueDiagram = (diagram, identifier) => {
      if (!diagram || diagram.present === false || !diagram.bounding_box) {
        return
      }
      tasks.push(
        this.cropAndUploadDiagram(diagram, identifier, folder, pageCache, { pageOffset }).catch((error) => {
          console.error(`Failed to process diagram ${identifier}:`, error.message)
        })
      )
    }

    questions.forEach((question, questionIndex) => {
      enqueueDiagram(question.diagram, `question_${question.id || questionIndex}`)

      if (Array.isArray(question.options)) {
        question.options.forEach((option, optionIndex) => {
          enqueueDiagram(option.diagram, `question_${question.id || questionIndex}_option_${option.label || optionIndex}`)
        })
      }
    })

    await Promise.all(tasks)
  }

  async cropAndUploadDiagram(diagram, identifier, folder, pageCache, { pageOffset = 0 } = {}) {
    if (!diagram || diagram.present === false || !diagram.bounding_box) {
      return
    }

    const pageNumber = Math.max(1, (diagram.page || 1) - pageOffset)

    try {
      if (!pageCache.has(pageNumber)) {
        const pageBuffer = await renderPdfToPng(this.lastPdfBuffer, { page: pageNumber, density: DEFAULT_PDF_DENSITY })
        pageCache.set(pageNumber, pageBuffer)
      }

      const pagePng = pageCache.get(pageNumber)
      const croppedBuffer = await cropBoundingBox(pagePng, diagram)

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: identifier,
            overwrite: true,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) {
              return reject(error)
            }
            resolve(result)
          }
        )

        stream.end(croppedBuffer)
      })

      diagram.url = uploadResult.secure_url || uploadResult.url
      diagram.uploaded_at = new Date().toISOString()
    } catch (error) {
      console.error(`Failed to crop/upload diagram ${identifier}:`, error.message)
      diagram.url = null
      diagram.upload_error = error.message
    }
  }
}

// Export the instance
module.exports = new GeminiParser();

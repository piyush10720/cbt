const axios = require('axios');

class GeminiExplanationService {
  constructor() {
    let apiKey = process.env.GEMINI_API_KEY;
    
    // Handle case where API key is stored as a JSON array string
    if (apiKey && apiKey.startsWith('[') && apiKey.endsWith(']')) {
      try {
        const parsed = JSON.parse(apiKey);
        if (Array.isArray(parsed) && parsed.length > 0) {
          apiKey = parsed[0];
        }
      } catch (e) {
        console.warn('Failed to parse GEMINI_API_KEY as JSON array, using as is.');
      }
    }

    this.apiKey = apiKey;
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // Updated to flash as seen in logs
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    if (!this.apiKey) {
      console.warn('Gemini API key not configured. Explanation service will fail without it.');
    }
  }

  async generateExplanation({ question, answerRecord, examTitle, images = [] }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const userAnswer = this.serializeAnswer(answerRecord.userAnswer, question);
    const correctAnswer = this.serializeAnswer(answerRecord.correctAnswer && answerRecord.correctAnswer.length > 0 ? answerRecord.correctAnswer : question.correct, question);

    const prompt = this.buildPrompt({
      examTitle,
      question,
      userAnswer,
      correctAnswer,
      isCorrect: answerRecord.isCorrect,
      marksAwarded: answerRecord.marksAwarded,
      hasImages: images.length > 0
    });

    const parts = [{ text: prompt }];

    // Fetch and attach images
    for (const img of images) {
      try {
        const base64Data = await this.fetchImageAsBase64(img.url);
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: base64Data
            }
          });
          parts.push({ text: `\n[Image Context: ${img.label || 'Related Image'}]` });
        }
      } catch (error) {
        console.warn(`Failed to fetch image for explanation: ${img.url}`, error.message);
      }
    }

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
        timeout: 60000 // Increased timeout for image processing
      }
    );

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const text = response.data.candidates[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned empty explanation');
    }

    return this.safeParseResponse(text);
  }

  async fetchImageAsBase64(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data, 'binary').toString('base64');
    } catch (error) {
      console.error('Error fetching image:', error.message);
      return null;
    }
  }

  serializeAnswer(answer, question) {
    if (Array.isArray(answer)) {
      return answer.map(a => this.resolveAnswerToText(a, question)).join('\n');
    }
    return this.resolveAnswerToText(answer, question);
  }

  resolveAnswerToText(answer, question) {
    if (answer === null || answer === undefined) return 'No answer provided';
    if (question.type === 'descriptive') {
        return (answer && typeof answer === 'object' && answer.text) ? answer.text : String(answer);
    }

    const normalize = s => String(s).trim().toUpperCase();
    const target = normalize(answer);

    const options = question.options || [];
    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        // Determine label (A, B, C...)
        const label = typeof opt === 'string' 
            ? String.fromCharCode(65 + i) 
            : (opt.label || String.fromCharCode(65 + i));
        
        // Determine text
        const text = typeof opt === 'string' ? opt : (opt.text || opt.label || 'Image Option');

        // Check if answer matches label
        if (normalize(label) === target) {
            return `${label}. ${text}`;
        }
        
        // Check if answer matches text (fallback)
        if (normalize(text) === target) {
            return `${label}. ${text}`;
        }
    }

    return String(answer);
  }

  buildPrompt({ examTitle, question, userAnswer, correctAnswer, isCorrect, marksAwarded, hasImages }) {
    return `You are an exam explanation assistant. Provide a short, factual explanation for the question and answers provided. ${hasImages ? 'Refer to the provided images (diagrams or user answers) where relevant.' : ''} Avoid any personal or sensitive information. Respond in strictly valid JSON with keys "overview", "why_user_answer", "why_correct_answer", "tips".

Exam Title: ${examTitle}
Question Type: ${question.type}
Question Text: ${question.text}
Options:
${(question.options || []).map((option, index) => {
    const label = typeof option === 'string' ? String.fromCharCode(65 + index) : (option.label || String.fromCharCode(65 + index));
    const text = typeof option === 'string' ? option : (option.text || option.label || 'Image Option');
    return `${label}. ${text}`;
}).join('\n') || 'N/A'}
User Answer: ${userAnswer}
Correct Answer: ${correctAnswer}
Was User Answer Correct: ${isCorrect}
Marks Awarded: ${marksAwarded}

Response Format:
{
  "overview": "short neutral summary",
  "why_user_answer": "neutral explanation why user answer is incorrect or correct",
  "why_correct_answer": "neutral explanation why correct answer is correct",
  "tips": ["actionable tip 1", "actionable tip 2"]
}

Keep it concise.`;
  }

  safeParseResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overview: this.ensureString(parsed.overview),
        why_user_answer: this.ensureString(parsed.why_user_answer),
        why_correct_answer: this.ensureString(parsed.why_correct_answer),
        tips: Array.isArray(parsed.tips)
          ? parsed.tips.map((tip) => this.ensureString(tip)).filter(Boolean)
          : []
      };
    } catch (error) {
      console.error('Failed to parse Gemini explanation response:', error);
      throw new Error('Failed to parse explanation response');
    }
  }

  ensureString(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }
}

module.exports = new GeminiExplanationService();

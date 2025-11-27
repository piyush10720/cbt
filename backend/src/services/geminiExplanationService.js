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

  async generateExplanation({ question, answerRecord, examTitle }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const userAnswer = this.serializeAnswer(answerRecord.userAnswer);
    const correctAnswer = this.serializeAnswer(answerRecord.correctAnswer && answerRecord.correctAnswer.length > 0 ? answerRecord.correctAnswer : question.correct);

    const prompt = this.buildPrompt({
      examTitle,
      question,
      userAnswer,
      correctAnswer,
      isCorrect: answerRecord.isCorrect,
      marksAwarded: answerRecord.marksAwarded
    });

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
          'x-goog-api-key': this.apiKey
        },
        timeout: 30000
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

  serializeAnswer(answer) {
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }
    if (answer === null || answer === undefined) {
      return 'No answer provided';
    }
    return String(answer);
  }

  buildPrompt({ examTitle, question, userAnswer, correctAnswer, isCorrect, marksAwarded }) {
    return `You are an exam explanation assistant. Provide a short, factual explanation for the question and answers provided. Avoid any personal or sensitive information. Respond in strictly valid JSON with keys "overview", "why_user_answer", "why_correct_answer", "tips".

Exam Title: ${examTitle}
Question Type: ${question.type}
Question Text: ${question.text}
Options: ${(question.options || []).map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(' | ') || 'N/A'}
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

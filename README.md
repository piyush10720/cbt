# CBT Platform - Computer Based Testing System

A modern, full-stack Computer Based Testing platform built with React.js, Node.js, MongoDB, and AI-powered question parsing using Google's Gemini API.

## 🚀 Features

### Core Features
- **User Authentication**: JWT-based signup/login with role-based access (Student/Teacher/Admin)
- **Exam Creation**: Upload PDF question papers and answer keys with AI-powered parsing
- **CBT Mode**: Timer-based exam taking with anti-cheating measures
- **Real-time Results**: Instant grading and detailed analytics
- **Dashboard**: Performance tracking and exam history

### AI-Powered Question Parsing
- **PDF Upload**: Support for question paper and answer key PDFs
- **Gemini Integration**: Automatic extraction and structuring of questions
- **Multiple Question Types**: MCQ (single/multiple), True/False, Numeric, Descriptive
- **Manual Editing**: Review and edit parsed questions before publishing

### Exam Features
- **Timer Management**: Auto-submit on time expiry
- **Question Navigation**: Mark for review, skip, and navigate between questions
- **Anti-Cheating**: Tab switch detection, fullscreen enforcement
- **Flexible Settings**: Negative marking, question randomization, time limits
- **Access Control**: Public, private, or restricted exam access

### Analytics & Results
- **Instant Grading**: Automatic scoring for objective questions
- **Performance Analytics**: Score breakdown, time analysis, strengths/weaknesses
- **Detailed Reports**: Question-wise analysis and recommendations
- **Exam History**: Complete record of all attempts and results

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **TailwindCSS** for styling
- **shadcn/ui** for modern UI components
- **React Router** for navigation
- **React Query** for state management
- **Axios** for API calls
- **React Hook Form** for form handling

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Multer** for file uploads
- **pdf-parse** for PDF text extraction
- **Google Gemini API** for AI-powered question parsing
- **Bcrypt** for password hashing

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (v16 or higher)
- **MongoDB** (v4.4 or higher)
- **Google Gemini API Key** (for question parsing)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd cbt-platform
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/cbt_platform
# JWT_SECRET=your_super_secret_jwt_key_here
# JWT_EXPIRE=7d
# GEMINI_API_KEY=your_gemini_api_key_here
# NODE_ENV=development
# CORS_ORIGIN=http://localhost:3000

# Start the backend server
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Create environment file (optional)
# VITE_API_URL=http://localhost:5000/api

# Start the frontend development server
npm run dev
```

### 4. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cbt_platform
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=7d
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

### Getting Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your backend .env file

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Exam Endpoints
- `GET /api/exam` - Get all exams
- `GET /api/exam/:id` - Get exam by ID
- `POST /api/exam` - Create new exam (Teacher/Admin)
- `PUT /api/exam/:id` - Update exam (Teacher/Admin)
- `POST /api/exam/:id/publish` - Publish exam (Teacher/Admin)
- `DELETE /api/exam/:id` - Delete exam (Teacher/Admin)
- `POST /api/exam/:id/start` - Start exam attempt

### Upload Endpoints
- `POST /api/upload/question-paper` - Upload question paper PDF
- `POST /api/upload/answer-key` - Upload answer key PDF
- `POST /api/upload/complete-exam` - Upload both files together
- `GET /api/upload/test-gemini` - Test Gemini API connection

### Result Endpoints
- `POST /api/result/:resultId/answer` - Submit answer for question
- `GET /api/result/:resultId/progress` - Get exam progress
- `POST /api/result/:resultId/submit` - Submit final exam
- `GET /api/result/:resultId` - Get result details
- `GET /api/result` - Get user results
- `POST /api/result/:resultId/cheating-flag` - Add cheating flag

## 🎯 Usage Guide

### For Teachers

1. **Create Account**: Register as a teacher
2. **Create Exam**: 
   - Upload PDF question paper and answer key
   - Review and edit parsed questions
   - Configure exam settings (duration, marking scheme, etc.)
   - Set schedule and access permissions
   - Publish exam
3. **Monitor Results**: View student performance and analytics

### For Students

1. **Create Account**: Register as a student
2. **Take Exams**:
   - Browse available exams
   - Start exam attempt
   - Answer questions within time limit
   - Submit exam
3. **View Results**: Check scores and detailed analytics

## 🔒 Security Features

- **JWT Authentication** with secure token handling
- **Password Hashing** using bcrypt
- **Input Validation** and sanitization
- **Rate Limiting** to prevent abuse
- **CORS Configuration** for cross-origin requests
- **Anti-Cheating Measures**:
  - Tab switch detection
  - Fullscreen enforcement
  - Time tracking
  - Browser fingerprinting

## 📊 Question Schema

The platform supports the following question format:

```json
{
  "id": "q1",
  "type": "mcq_single | mcq_multi | true_false | numeric | descriptive",
  "text": "Question text",
  "options": ["A", "B", "C", "D"],
  "correct": ["B"],
  "marks": 4,
  "negative_marks": -1,
  "difficulty": "easy | medium | hard",
  "subject": "Subject name",
  "topic": "Topic name",
  "explanation": "Explanation text"
}
```

## 🚀 Deployment

### Backend Deployment (Heroku/Railway/Render)
1. Set environment variables
2. Deploy using Git or Docker
3. Ensure MongoDB connection

### Frontend Deployment (Vercel/Netlify)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Set environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## 🔮 Future Enhancements

- [ ] Real-time proctoring with webcam monitoring
- [ ] Advanced analytics with ML insights
- [ ] Mobile app for iOS and Android
- [ ] Integration with LMS platforms
- [ ] Multi-language support
- [ ] Offline exam capability
- [ ] Advanced question types (drag-drop, matching)
- [ ] Plagiarism detection for descriptive answers
- [ ] Bulk user import/export
- [ ] Custom branding options

---

Built with ❤️ using modern web technologies

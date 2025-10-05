# CBT Platform Setup Guide

## Quick Start (Without Gemini API)

The platform will work with sample questions even without a Gemini API key. Follow these steps:

### 1. Backend Setup
```bash
cd cbt-platform/backend
npm install
npm run dev
```

### 2. Frontend Setup
```bash
cd cbt-platform/frontend
npm install
npm run dev
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Full Setup (With Gemini API)

### 1. Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables

**Backend (.env)**:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/cbt_platform
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production_min_32_chars
JWT_EXPIRE=7d
GEMINI_API_KEY=your_actual_gemini_api_key_here
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env)**:
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=CBT Platform
VITE_APP_VERSION=1.0.0
VITE_NODE_ENV=development
```

### 3. Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Setup MongoDB
- Install MongoDB locally, or
- Use MongoDB Atlas (cloud)
- Update MONGODB_URI in .env

## Features Available

### Without Gemini API:
- ✅ User authentication
- ✅ Manual exam creation
- ✅ Sample question generation
- ✅ Exam taking and grading
- ✅ Results and analytics

### With Gemini API:
- ✅ All above features
- ✅ AI-powered PDF question parsing
- ✅ Automatic answer key alignment
- ✅ Smart question extraction

## Troubleshooting

### Common Issues:

1. **PostCSS Error**: Fixed - using CommonJS syntax
2. **Gemini API 404**: Fixed - fallback to sample questions
3. **MongoDB Connection**: Ensure MongoDB is running
4. **CORS Errors**: Check CORS_ORIGIN in backend .env

### Demo Credentials:
- Teacher: teacher@demo.com / password123
- Student: student@demo.com / password123

## Next Steps

1. Create your first exam using the sample questions
2. Test the exam taking flow
3. Add your Gemini API key for PDF parsing
4. Upload real question papers

The platform is now ready to use!

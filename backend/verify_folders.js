const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let token = '';
let createdFolderId = '';
let subFolderId = '';
let examId1 = '';
let examId2 = '';
// Register and Login
async function login() {
  const email = `ps671248@gmail.com`;
  const password = '12345678@aA';
  
  try {
    // Try to register first
    await axios.post(`${API_URL}/auth/register`, {
      name: 'Test Teacher',
      email,
      password,
      role: 'teacher'
    });
    console.log('✅ Registration successful');
  } catch (e) {
    // Ignore if already exists
  }

  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    token = res.data.token;
    console.log('✅ Login successful');
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Create Folder
async function createFolder() {
  try {
    const res = await axios.post(`${API_URL}/folders`, {
      name: 'Test Folder ' + Date.now()
    }, { headers: { Authorization: `Bearer ${token}` } });
    createdFolderId = res.data._id;
    console.log('✅ Folder created:', res.data.name);
  } catch (error) {
    console.error('❌ Create folder failed:', error.response?.data || error.message);
  }
}

// Create Subfolder
async function createSubFolder() {
  try {
    const res = await axios.post(`${API_URL}/folders`, {
      name: 'Subfolder ' + Date.now(),
      parent: createdFolderId
    }, { headers: { Authorization: `Bearer ${token}` } });
    subFolderId = res.data._id;
    console.log('✅ Subfolder created:', res.data.name);
  } catch (error) {
    console.error('❌ Create subfolder failed:', error.response?.data || error.message);
  }
}

// Create Dummy Exams
async function createExams() {
  try {
    const exam1 = await axios.post(`${API_URL}/exam`, {
      title: 'Exam 1 ' + Date.now(),
      settings: { duration: 60, totalMarks: 100 },
      schedule: { startDate: new Date(), endDate: new Date(Date.now() + 86400000) },
      questions: [{
        id: 'q1_' + Date.now(),
        text: 'Dummy Question 1',
        type: 'mcq_single',
        options: ['A', 'B', 'C', 'D'],
        correct: ['A'],
        marks: 1
      }]
    }, { headers: { Authorization: `Bearer ${token}` } });
    examId1 = exam1.data.exam.id;

    const exam2 = await axios.post(`${API_URL}/exam`, {
      title: 'Exam 2 ' + Date.now(),
      settings: { duration: 60, totalMarks: 100 },
      schedule: { startDate: new Date(), endDate: new Date(Date.now() + 86400000) },
      questions: [{
        id: 'q2_' + Date.now(),
        text: 'Dummy Question 2',
        type: 'mcq_single',
        options: ['X', 'Y', 'Z'],
        correct: ['X'],
        marks: 1
      }]
    }, { headers: { Authorization: `Bearer ${token}` } });
    examId2 = exam2.data.exam.id;
    console.log('✅ Exams created');
  } catch (error) {
    console.error('❌ Create exams failed:', error.response?.data || error.message);
  }
}

// Add Exam to Folder
async function addExamToFolder() {
  try {
    await axios.post(`${API_URL}/folders/add-exam`, {
      examId: examId1,
      folderId: createdFolderId
    }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('✅ Exam added to folder');
  } catch (error) {
    console.error('❌ Add exam to folder failed:', error.response?.data || error.message);
  }
}

// Merge Exams
async function mergeExams() {
  try {
    const res = await axios.post(`${API_URL}/exam/merge`, {
      examIds: [examId1, examId2],
      title: 'Merged Exam ' + Date.now(),
      settings: { duration: 90 }
    }, { headers: { Authorization: `Bearer ${token}` } });
    console.log('✅ Exams merged:', res.data.exam.title);
  } catch (error) {
    console.error('❌ Merge exams failed:', error.response?.data || error.message);
  }
}

// Delete Folder
async function deleteFolder() {
  try {
    await axios.delete(`${API_URL}/folders/${createdFolderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Folder deleted');
  } catch (error) {
    console.error('❌ Delete folder failed:', error.response?.data || error.message);
  }
}

// Verify Root Exams
async function verifyRootExams() {
  try {
    const res = await axios.get(`${API_URL}/exam?folderId=root`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const exams = res.data.exams;
    const found = exams.find(e => e.id === examId2);
    if (found) {
      console.log('✅ Root exams verification successful');
    } else {
      console.error('❌ Root exams verification failed: Exam 2 not found in root');
    }
  } catch (error) {
    console.error('❌ Verify root exams failed:', error.response?.data || error.message);
  }
}

async function run() {
  await login();
  await createFolder();
  await createSubFolder();
  await createExams();
  await addExamToFolder();
  await verifyRootExams();
  await mergeExams();
  await deleteFolder();
}

run();

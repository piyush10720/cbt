const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Exam = require('../src/models/Exam');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

const backfillPracticeMode = async () => {
  try {
    await connectDB();

    console.log('Starting backfill for allowPracticeMode...');

    const result = await Exam.updateMany(
      { 'settings.allowPracticeMode': { $exists: false } },
      { $set: { 'settings.allowPracticeMode': true } }
    );

    console.log(`Backfill complete. Matched ${result.matchedCount} exams, modified ${result.modifiedCount} exams.`);

    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
};

backfillPracticeMode();

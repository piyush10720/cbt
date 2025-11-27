const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Question = require('../src/models/Question');

async function backfillNumericRanges() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const questions = await Question.find({ type: 'numeric' });
    console.log(`Found ${questions.length} numeric questions.`);

    let updatedCount = 0;
    const updates = [];

    for (const q of questions) {
      if (q.correct && q.correct.length > 0) {
        const answer = q.correct[0];
        // Regex to match old format: positive number - positive number
        // e.g. "10-20", "10.5-20.5"
        // Avoid matching negative numbers like "-5" or "-5--10" if they existed (though UI prevented it)
        const rangeRegex = /^(\d+(\.\d+)?)-(\d+(\.\d+)?)$/;
        
        if (rangeRegex.test(answer)) {
          const parts = answer.split('-');
          if (parts.length === 2) {
            const newAnswer = `${parts[0]} to ${parts[1]}`;
            console.log(`[${q._id}] Converting "${answer}" -> "${newAnswer}"`);
            
            q.correct = [newAnswer];
            updates.push(q.save());
            updatedCount++;
          }
        }
      }
    }

    if (updates.length > 0) {
      console.log(`Saving ${updates.length} updates...`);
      await Promise.all(updates);
      console.log('All updates saved.');
    } else {
      console.log('No questions needed updating.');
    }

  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

backfillNumericRanges();

const mongoose = require('mongoose');

/**
 * Migration script to update Exam access.type values
 * from old terminology (private/restricted/public) to new (owner/invited/public)
 * 
 * Run this script once to migrate existing data:
 * node backend/migrations/updateExamAccessTypes.js
 */

async function migrateExamAccessTypes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cbt-platform';
    await mongoose.connect(mongoUri);
    
    console.log('Connected to MongoDB');
    console.log('Starting migration of Exam access types...\n');

    const Exam = mongoose.model('Exam');

    // Update 'private' to 'owner'
    const privateResult = await Exam.updateMany(
      { 'access.type': 'private' },
      { $set: { 'access.type': 'owner' } }
    );
    console.log(`✓ Updated ${privateResult.modifiedCount} exams from 'private' to 'owner'`);

    // Update 'restricted' to 'invited'
    const restrictedResult = await Exam.updateMany(
      { 'access.type': 'restricted' },
      { $set: { 'access.type': 'invited' } }
    );
    console.log(`✓ Updated ${restrictedResult.modifiedCount} exams from 'restricted' to 'invited'`);

    // 'public' remains the same, but let's count them
    const publicCount = await Exam.countDocuments({ 'access.type': 'public' });
    console.log(`✓ Found ${publicCount} exams with 'public' access (no change needed)`);

    // Verify migration
    console.log('\nVerifying migration...');
    const ownerCount = await Exam.countDocuments({ 'access.type': 'owner' });
    const invitedCount = await Exam.countDocuments({ 'access.type': 'invited' });
    const publicCountAfter = await Exam.countDocuments({ 'access.type': 'public' });
    const oldCount = await Exam.countDocuments({ 
      'access.type': { $in: ['private', 'restricted'] } 
    });

    console.log(`\nFinal counts:`);
    console.log(`  - Owner: ${ownerCount}`);
    console.log(`  - Invited: ${invitedCount}`);
    console.log(`  - Public: ${publicCountAfter}`);
    console.log(`  - Old values remaining: ${oldCount}`);

    if (oldCount === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Warning: Some exams still have old access type values');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateExamAccessTypes()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migrateExamAccessTypes };

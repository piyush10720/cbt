const GeminiCreator = require('./src/services/geminiCreator');

async function testBatching() {
  console.log('🧪 Testing Batching Logic...');

  // Mock environment variables
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'gemini-1.5-flash';

  let callCount = 0;
  
  // Monkey patch _generateSingleBatch for testing
  // We save the original just in case, though we won't use it here
  const originalGenerate = GeminiCreator._generateSingleBatch;
  
  GeminiCreator._generateSingleBatch = async (params) => {
    callCount++;
    console.log(`  -> _generateSingleBatch called with count: ${params.count}`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return dummy questions
    const questions = [];
    for (let i = 0; i < params.count; i++) {
        // Intentionally create some duplicates across batches to test de-duplication
        // If callCount is 1 (Batch 1), generate Q0-Q9
        // If callCount is 2 (Batch 2), generate Q7-Q14 (Overlap Q7, Q8, Q9)
        
        // Logic to force overlap:
        // Batch 1 (10 items): starts at 0 -> 0..9
        // Batch 2 (8 items): starts at 7 -> 7..14
        const startIndex = (callCount - 1) * 7; 
        const globalIndex = startIndex + i;
        
        // Generate distinct text for each index to avoid Jaccard similarity of 1.0
        // We use a distinct word for each index
        const distinctWords = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon', 'mango', 'nectarine', 'orange', 'papaya', 'quince', 'raspberry', 'strawberry', 'tangerine', 'ugli', 'vanilla'];
        const word = distinctWords[globalIndex % distinctWords.length] || `item${globalIndex}`;

        questions.push({
            id: `mock_${globalIndex}`,
            text: `What is the color of the ${word} in the basket?`,
            options: [{label: 'A', text: 'Opt A'}],
            correct: ['A']
        });
    }
    return questions;
  };

  // Test Case: Request 15 questions
  // Should trigger:
  // 1. Over-generate target: ceil(15 * 1.2) = 18
  // 2. Batches: ceil(18 / 10) = 2 batches
  // 3. Batch 1: 10 questions (Indices 0-9)
  // 4. Batch 2: 8 questions (Indices 7-14)
  // Total raw questions: 18
  // Unique indices: 0-14 (15 unique items)
  // Overlap: 7, 8, 9 (3 duplicates)
  
  console.log('\n--- Scenario: Requesting 15 questions ---');
  try {
      const results = await GeminiCreator.generateQuestionsFromPrompt({
        topic: 'Test',
        subject: 'Test',
        grade: '10',
        count: 15,
        type: 'mcq_single',
        difficulty: 50
      });

      console.log('\n--- Results ---');
      console.log(`Total Questions Returned: ${results.length}`);
      console.log(`Total Batch Calls: ${callCount}`);
      
      // Verify de-duplication
      const uniqueTexts = new Set(results.map(q => q.text));
      console.log(`Unique Texts: ${uniqueTexts.size}`);
      
      if (results.length === 15 && uniqueTexts.size === 15) {
          console.log('✅ SUCCESS: Returned exactly 15 unique questions.');
      } else {
          console.log('❌ FAILURE: Incorrect count or duplicates found.');
          console.log('Returned IDs:', results.map(q => q.id));
      }
  } catch (error) {
      console.error('Test Failed with Error:', error);
  }
}

testBatching().catch(console.error);

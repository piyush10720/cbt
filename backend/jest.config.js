module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],
  setupFilesAfterEnv: [],
  testTimeout: 60000, // 60 seconds for integration tests with API calls
  verbose: true
};


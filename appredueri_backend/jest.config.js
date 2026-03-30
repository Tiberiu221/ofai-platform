module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/public/**',
    '!src/views/**',
    '!src/migrations/**',
  ],
  coverageDirectory: 'coverage',
  testTimeout: 10000,
};

/**
 * Jest Configuration for RBAC Testing
 *
 * This configuration sets up Jest to run tests with Supertest
 * for testing Express API endpoints with different roles.
 */

module.exports = {
  // Set root directory to the whole project
  rootDir: '..',

  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/rbac/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/controllers/**/*.test.js'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'middleware/authJwt.js',
    'controllers/admin.controller.js',
    'controllers/role.controller.js',
    'controllers/leave.controller.js',
    'controllers/onduty.controller.js',
    'routes/**/*.routes.js'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      statements: 10,
      branches: 10,
      functions: 10,
      lines: 10
    },
    './middleware/authJwt.js': {
      statements: 10,
      branches: 10,
      functions: 10,
      lines: 10
    }
  },

  // Timeout for async tests (5 seconds)
  testTimeout: 5000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Force exit after all tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: false,

  // Maximum number of concurrent workers
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts

  // Add the custom CSV reporter
  reporters: [
    'default',
    '<rootDir>/tests/csv-reporter.js'
  ],

  // Save test results to test-results folder
  coverageDirectory: '<rootDir>/test-results/coverage',

  // Coverage report formats (lcov required for SonarQube)
  coverageReporters: ['text', 'lcov', 'json-summary', 'html'],

  // Additional test result outputs
  testResultsProcessor: '<rootDir>/tests/test-results-processor.js'
};

/**
 * Test Results Processor
 * Saves Jest test results to the test-results folder after each test run
 */

const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  // Create test-results directory if it doesn't exist
  const testResultsDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  // Generate timestamp for the result file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = path.join(testResultsDir, `test-results-${timestamp}.json`);

  // Prepare summary data
  const summary = {
    timestamp: new Date().toISOString(),
    success: results.numFailedTests === 0,
    numTotalTests: results.numTotalTests,
    numPassedTests: results.numPassedTests,
    numFailedTests: results.numFailedTests,
    numPendingTests: results.numPendingTests,
    numTotalTestSuites: results.numTotalTestSuites,
    numPassedTestSuites: results.numPassedTestSuites,
    numFailedTestSuites: results.numFailedTestSuites,
    testResults: results.testResults.map(suite => ({
      testFilePath: suite.testFilePath.replace(process.cwd(), ''),
      numPassingTests: suite.numPassingTests,
      numFailingTests: suite.numFailingTests,
      numPendingTests: suite.numPendingTests,
      failureMessage: suite.failureMessage,
      testResults: suite.testResults.map(test => ({
        title: test.title,
        fullName: test.fullName,
        status: test.status,
        duration: test.duration,
        failureMessages: test.failureMessages
      }))
    }))
  };

  // Write results to file
  fs.writeFileSync(resultFile, JSON.stringify(summary, null, 2));

  // Also write a latest.json symlink/copy for easy access
  const latestFile = path.join(testResultsDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(summary, null, 2));

  console.log(`\n✓ Test results saved to: ${resultFile}`);
  console.log(`✓ Latest results available at: ${latestFile}\n`);

  return results;
};

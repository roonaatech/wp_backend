const fs = require('fs');
const path = require('path');

class CSVReporter {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;
    }

    onRunComplete(contexts, results) {
        // Header for the CSV file
        const csvLines = [
            'Test Suite,Test Case,Status,Duration (ms),Error Message'
        ];

        // Iterate over test suites
        results.testResults.forEach(testSuite => {
            const suiteName = path.basename(testSuite.testFilePath);

            // Iterate over individual test cases
            testSuite.testResults.forEach(test => {
                // Build the full test name from its ancestor titles (describe blocks)
                const testName = [...test.ancestorTitles, test.title].join(' › ');
                const status = test.status.toUpperCase();
                const duration = test.duration || 0;

                // Clean up error message to fit in a CSV cell
                const errorMessage = test.failureMessages.length > 0
                    ? `"${test.failureMessages[0].replace(/"/g, '""').replace(/\n/g, ' | ')}"`
                    : '';

                // Add row
                csvLines.push(`"${suiteName}","${testName}","${status}","${duration}",${errorMessage}`);
            });
        });

        const reportPath = path.resolve(process.cwd(), 'tests', 'test-execution-report.csv');
        fs.writeFileSync(reportPath, csvLines.join('\n'));
        console.log(`\n📊 Test results saved to CSV: ${reportPath}\n`);
    }
}

module.exports = CSVReporter;

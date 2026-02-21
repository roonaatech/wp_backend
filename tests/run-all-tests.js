/**
 * Consolidated Test Runner
 * Runs all test suites and generates a comprehensive XLSX report with multiple tabs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const TEST_RESULTS_DIR = path.join(__dirname, '..', 'test-results');

// Ensure test-results directory exists
if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

/**
 * Clean up old test result files from test-results directory
 * Keeps: README.md, latest.json, exhaustive-latest.json, and consolidated-test-results-latest.xlsx
 * Removes: All timestamped result files
 */
function cleanupTestResults() {
    console.log('\n🧹 Cleaning up old test results...');

    if (!fs.existsSync(TEST_RESULTS_DIR)) {
        console.log('   No cleanup needed - directory does not exist');
        return;
    }

    const filesToKeep = [
        'README.md',
        'latest.json',
        'exhaustive-latest.json',
        'consolidated-test-results-latest.xlsx'
    ];

    let removedCount = 0;

    try {
        const files = fs.readdirSync(TEST_RESULTS_DIR);

        for (const file of files) {
            const filePath = path.join(TEST_RESULTS_DIR, file);
            const stat = fs.statSync(filePath);

            // Skip directories (like coverage/)
            if (stat.isDirectory()) {
                // Remove coverage directory if it exists
                if (file === 'coverage') {
                    fs.rmSync(filePath, { recursive: true, force: true });
                    console.log(`   ✓ Removed coverage directory`);
                    removedCount++;
                }
                continue;
            }

            // Keep essential files
            if (filesToKeep.includes(file)) {
                continue;
            }

            // Remove old timestamped files
            fs.unlinkSync(filePath);
            removedCount++;
        }

        console.log(`   ✓ Cleaned up ${removedCount} old file(s)\n`);
    } catch (err) {
        console.error(`   ⚠️  Cleanup warning: ${err.message}\n`);
    }
}

class ConsolidatedTestRunner {
    constructor() {
        this.results = {
            summary: {
                timestamp: new Date().toISOString(),
                overallSuccess: true,
                tests: []
            },
            jestResults: null,
            rbacResults: null,
            coverageResults: null,
            exhaustiveResults: null
        };
        // Excel cell character limit
        this.EXCEL_CELL_LIMIT = 32000; // Use 32000 to be safe (actual limit is 32767)
    }

    // Helper to truncate text for Excel cells
    truncateForExcel(text) {
        if (!text) return '';
        const str = String(text);
        if (str.length <= this.EXCEL_CELL_LIMIT) return str;
        return str.substring(0, this.EXCEL_CELL_LIMIT - 50) + '... [TRUNCATED]';
    }

    log(message) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  ${message}`);
        console.log('='.repeat(60));
    }

    async runCommand(command, testName, description) {
        this.log(`Running: ${testName}`);
        console.log(`Command: ${command}\n`);

        const startTime = Date.now();
        let success = true;
        let output = '';
        let error = '';

        try {
            output = execSync(command, {
                cwd: path.join(__dirname, '..'),
                encoding: 'utf-8',
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'test' }
            });
            console.log(output);
        } catch (err) {
            success = false;
            error = err.message;
            output = err.stdout || '';
            console.error(`❌ ${testName} failed:`, err.message);
            this.results.summary.overallSuccess = false;
        }

        const duration = Date.now() - startTime;

        this.results.summary.tests.push({
            name: testName,
            description,
            success,
            duration: `${(duration / 1000).toFixed(2)}s`,
            error: error || 'None'
        });

        return { success, output, duration };
    }

    async runJestTests() {
        const result = await this.runCommand(
            'NODE_ENV=test jest --config tests/jest.config.js --json',
            'Jest Tests (All)',
            'Run all Jest test suites'
        );

        // Try to read the latest JSON result
        try {
            const latestFile = path.join(TEST_RESULTS_DIR, 'latest.json');
            if (fs.existsSync(latestFile)) {
                this.results.jestResults = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
            }
        } catch (err) {
            console.error('Could not read Jest results:', err.message);
        }

        return result;
    }

    async runRBACTests() {
        const result = await this.runCommand(
            'NODE_ENV=test jest --config tests/jest.config.js tests/rbac --json',
            'RBAC Tests',
            'Run role-based access control tests'
        );

        try {
            const latestFile = path.join(TEST_RESULTS_DIR, 'latest.json');
            if (fs.existsSync(latestFile)) {
                this.results.rbacResults = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
            }
        } catch (err) {
            console.error('Could not read RBAC results:', err.message);
        }

        return result;
    }

    async runCoverageTests() {
        const result = await this.runCommand(
            'NODE_ENV=test jest --config tests/jest.config.js --coverage --json',
            'Coverage Tests',
            'Run tests with code coverage analysis'
        );

        try {
            const coverageSummaryFile = path.join(TEST_RESULTS_DIR, 'coverage', 'coverage-summary.json');
            if (fs.existsSync(coverageSummaryFile)) {
                this.results.coverageResults = JSON.parse(fs.readFileSync(coverageSummaryFile, 'utf-8'));
            }
        } catch (err) {
            console.error('Could not read coverage results:', err.message);
        }

        return result;
    }

    async runExhaustiveTests() {
        const result = await this.runCommand(
            'NODE_ENV=test node tests/validation/exhaustive-rbac-test.js',
            'Exhaustive RBAC Tests',
            'Run comprehensive permission matrix tests'
        );

        try {
            const exhaustiveFile = path.join(TEST_RESULTS_DIR, 'exhaustive-latest.json');
            if (fs.existsSync(exhaustiveFile)) {
                this.results.exhaustiveResults = JSON.parse(fs.readFileSync(exhaustiveFile, 'utf-8'));
            }
        } catch (err) {
            console.error('Could not read exhaustive test results:', err.message);
        }

        return result;
    }

    generateExcelReport() {
        this.log('Generating Consolidated Excel Report');

        const workbook = XLSX.utils.book_new();

        // Tab 1: Summary
        this.addSummaryTab(workbook);

        // Tab 2: Jest Test Results
        if (this.results.jestResults) {
            this.addJestResultsTab(workbook);
        }

        // Tab 3: RBAC Test Results
        if (this.results.rbacResults) {
            this.addRBACResultsTab(workbook);
        }

        // Tab 4: Coverage Results
        if (this.results.coverageResults) {
            this.addCoverageTab(workbook);
        }

        // Tab 5: Exhaustive Test Results
        if (this.results.exhaustiveResults) {
            this.addExhaustiveResultsTab(workbook);
        }

        // Write the file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `consolidated-test-results-${timestamp}.xlsx`;
        const filePath = path.join(TEST_RESULTS_DIR, fileName);

        XLSX.writeFile(workbook, filePath);

        // Also save as latest
        const latestPath = path.join(TEST_RESULTS_DIR, 'consolidated-test-results-latest.xlsx');
        XLSX.writeFile(workbook, latestPath);

        console.log(`\n✅ Excel report generated:`);
        console.log(`   📊 ${filePath}`);
        console.log(`   📊 ${latestPath}\n`);

        return filePath;
    }

    addSummaryTab(workbook) {
        const data = [
            ['Consolidated Test Results - Summary'],
            ['Generated:', this.results.summary.timestamp],
            ['Overall Status:', this.results.summary.overallSuccess ? 'PASS ✅' : 'FAIL ❌'],
            [],
            ['Test Suite', 'Description', 'Status', 'Duration', 'Error'],
        ];

        this.results.summary.tests.forEach(test => {
            data.push([
                this.truncateForExcel(test.name),
                this.truncateForExcel(test.description),
                test.success ? 'PASS ✅' : 'FAIL ❌',
                test.duration,
                this.truncateForExcel(test.error)
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 25 },
            { wch: 40 },
            { wch: 15 },
            { wch: 12 },
            { wch: 50 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
    }

    addJestResultsTab(workbook) {
        const results = this.results.jestResults;

        const data = [
            ['Jest Test Results'],
            ['Timestamp:', results.timestamp],
            ['Status:', results.success ? 'PASS ✅' : 'FAIL ❌'],
            ['Total Tests:', results.numTotalTests],
            ['Passed:', results.numPassedTests],
            ['Failed:', results.numFailedTests],
            ['Pending:', results.numPendingTests],
            [],
            ['Test Suite', 'Test Name', 'Status', 'Duration (ms)', 'Failure Message']
        ];

        if (results.testResults) {
            results.testResults.forEach(suite => {
                suite.testResults.forEach(test => {
                    data.push([
                        this.truncateForExcel(suite.testFilePath),
                        this.truncateForExcel(test.title),
                        test.status.toUpperCase(),
                        test.duration || 'N/A',
                        this.truncateForExcel(test.failureMessages.join(' | ') || 'None')
                    ]);
                });
            });
        }

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        worksheet['!cols'] = [
            { wch: 40 },
            { wch: 50 },
            { wch: 12 },
            { wch: 15 },
            { wch: 60 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Jest Tests');
    }

    addRBACResultsTab(workbook) {
        const results = this.results.rbacResults;

        const data = [
            ['RBAC Test Results'],
            ['Timestamp:', results.timestamp],
            ['Status:', results.success ? 'PASS ✅' : 'FAIL ❌'],
            ['Total Tests:', results.numTotalTests],
            ['Passed:', results.numPassedTests],
            ['Failed:', results.numFailedTests],
            [],
            ['Test File', 'Test Name', 'Status', 'Duration (ms)']
        ];

        if (results.testResults) {
            results.testResults.forEach(suite => {
                suite.testResults.forEach(test => {
                    data.push([
                        this.truncateForExcel(suite.testFilePath),
                        this.truncateForExcel(test.fullName),
                        test.status.toUpperCase(),
                        test.duration || 'N/A'
                    ]);
                });
            });
        }

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        worksheet['!cols'] = [
            { wch: 40 },
            { wch: 60 },
            { wch: 12 },
            { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'RBAC Tests');
    }

    addCoverageTab(workbook) {
        const coverage = this.results.coverageResults;

        const data = [
            ['Code Coverage Summary'],
            ['Timestamp:', this.results.summary.timestamp],
            [],
            ['File', 'Statements %', 'Branches %', 'Functions %', 'Lines %', 'Uncovered Lines']
        ];

        Object.entries(coverage).forEach(([filePath, metrics]) => {
            if (filePath === 'total') return; // Skip total for now

            data.push([
                this.truncateForExcel(filePath),
                `${metrics.statements.pct}%`,
                `${metrics.branches.pct}%`,
                `${metrics.functions.pct}%`,
                `${metrics.lines.pct}%`,
                metrics.lines.total - metrics.lines.covered
            ]);
        });

        // Add total row
        if (coverage.total) {
            const total = coverage.total;
            data.push([]);
            data.push([
                'TOTAL',
                `${total.statements.pct}%`,
                `${total.branches.pct}%`,
                `${total.functions.pct}%`,
                `${total.lines.pct}%`,
                total.lines.total - total.lines.covered
            ]);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        worksheet['!cols'] = [
            { wch: 50 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 18 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Coverage');
    }

    addExhaustiveResultsTab(workbook) {
        const results = this.results.exhaustiveResults;

        const data = [
            ['Exhaustive RBAC Permission Matrix'],
            ['Timestamp:', results.timestamp],
            ['Status:', results.success ? 'PASS ✅' : 'FAIL ❌'],
            ['Total Combinations:', results.summary.totalCombinations],
            ['Passed:', results.summary.passed],
            ['Failed:', results.summary.failed],
            ['Pass Rate:', results.summary.passRate],
            [],
            ['Base Role', 'Permission', 'State', 'Method', 'Endpoint', 'Middleware', 'HTTP Code', 'Outcome', 'Expected', 'Status']
        ];

        if (results.results && results.results.length > 0) {
            // Limit to first 10000 rows to avoid Excel limitations
            const maxRows = Math.min(results.results.length, 10000);

            for (let i = 0; i < maxRows; i++) {
                const r = results.results[i];
                data.push([
                    this.truncateForExcel(r.BaseRole),
                    this.truncateForExcel(r.PermissionChecked),
                    this.truncateForExcel(r.OptionSelected),
                    this.truncateForExcel(r.HTTPOperation),
                    this.truncateForExcel(r.APIRoute),
                    this.truncateForExcel(r.MiddlewareEnforcements),
                    r.HTTPStatusReturned,
                    this.truncateForExcel(r.AuthorizationOutcome),
                    this.truncateForExcel(r.ExpectedOutcome),
                    r.TestStatus
                ]);
            }

            if (results.results.length > maxRows) {
                data.push([]);
                data.push([`Note: Showing first ${maxRows} of ${results.results.length} results due to Excel limitations`]);
            }
        }

        const worksheet = XLSX.utils.aoa_to_sheet(data);
        worksheet['!cols'] = [
            { wch: 20 },
            { wch: 30 },
            { wch: 15 },
            { wch: 10 },
            { wch: 35 },
            { wch: 40 },
            { wch: 12 },
            { wch: 15 },
            { wch: 15 },
            { wch: 10 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Exhaustive Tests');
    }

    async run() {
        console.log('\n');
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║                                                           ║');
        console.log('║        CONSOLIDATED TEST RUNNER - WorkPulse RBAC          ║');
        console.log('║                                                           ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('\n');

        // Clean up old test results before starting
        cleanupTestResults();

        const startTime = Date.now();

        // Run all test suites
        await this.runJestTests();
        await this.runRBACTests();
        await this.runCoverageTests();
        await this.runExhaustiveTests();

        // Generate Excel report
        const reportPath = this.generateExcelReport();

        const totalDuration = Date.now() - startTime;

        // Final summary
        this.log('FINAL SUMMARY');
        console.log('\n📊 Test Execution Summary:');
        console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log(`   Overall Status: ${this.results.summary.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
        console.log('\n📝 Individual Results:');

        this.results.summary.tests.forEach(test => {
            console.log(`   ${test.success ? '✅' : '❌'} ${test.name.padEnd(30)} ${test.duration}`);
        });

        console.log('\n📄 Reports Generated:');
        console.log(`   Excel: ${reportPath}`);
        console.log(`   JSON:  ${TEST_RESULTS_DIR}/`);
        console.log('\n');

        // Exit with appropriate code
        process.exit(this.results.summary.overallSuccess ? 0 : 1);
    }
}

// Run the consolidated tests
const runner = new ConsolidatedTestRunner();
runner.run().catch(err => {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
});

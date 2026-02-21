/**
 * Verify SonarQube Setup
 * Checks that all required files and configurations are in place
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying SonarQube Setup...\n');

let allChecksPass = true;

// Check 1: sonar-project.properties exists
const sonarPropsPath = path.join(__dirname, '..', 'sonar-project.properties');
if (fs.existsSync(sonarPropsPath)) {
    console.log('✅ sonar-project.properties found');

    // Read and validate contents
    const content = fs.readFileSync(sonarPropsPath, 'utf-8');
    if (content.includes('sonar.projectKey')) {
        console.log('   ✓ Project key configured');
    } else {
        console.log('   ⚠️  Project key missing');
        allChecksPass = false;
    }

    if (content.includes('sonar.javascript.lcov.reportPaths')) {
        console.log('   ✓ Coverage path configured');
    } else {
        console.log('   ⚠️  Coverage path missing');
        allChecksPass = false;
    }

    if (content.includes('sonar.testExecutionReportPaths')) {
        console.log('   ✓ Test execution path configured');
    } else {
        console.log('   ⚠️  Test execution path missing');
        allChecksPass = false;
    }
} else {
    console.log('❌ sonar-project.properties NOT found');
    allChecksPass = false;
}

console.log();

// Check 2: jest-sonar-reporter installed
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
if (packageJson.devDependencies && packageJson.devDependencies['jest-sonar-reporter']) {
    console.log('✅ jest-sonar-reporter installed');
    console.log(`   ✓ Version: ${packageJson.devDependencies['jest-sonar-reporter']}`);
} else {
    console.log('❌ jest-sonar-reporter NOT installed');
    console.log('   Run: npm install --save-dev jest-sonar-reporter');
    allChecksPass = false;
}

console.log();

// Check 3: Jest config includes sonar reporter
const jestConfigPath = path.join(__dirname, 'jest.config.js');
if (fs.existsSync(jestConfigPath)) {
    const jestConfig = fs.readFileSync(jestConfigPath, 'utf-8');
    if (jestConfig.includes('jest-sonar-reporter')) {
        console.log('✅ Jest configured with SonarQube reporter');
        console.log('   ✓ Reporter will generate: test-results/sonar-test-report.xml');
    } else {
        console.log('❌ Jest NOT configured with SonarQube reporter');
        allChecksPass = false;
    }
} else {
    console.log('❌ jest.config.js NOT found');
    allChecksPass = false;
}

console.log();

// Check 4: Test results directory
const testResultsDir = path.join(__dirname, '..', 'test-results');
if (fs.existsSync(testResultsDir)) {
    console.log('✅ test-results directory exists');

    // Check for coverage
    const coverageDir = path.join(testResultsDir, 'coverage');
    if (fs.existsSync(coverageDir)) {
        const lcovFile = path.join(coverageDir, 'lcov.info');
        if (fs.existsSync(lcovFile)) {
            const stats = fs.statSync(lcovFile);
            console.log(`   ✓ Coverage report found (${(stats.size / 1024).toFixed(2)} KB)`);
        } else {
            console.log('   ⚠️  Coverage report not found - run: npm run test:coverage');
        }
    } else {
        console.log('   ⚠️  Coverage directory not found - run: npm run test:coverage');
    }

    // Check for test report
    const sonarReportFile = path.join(testResultsDir, 'sonar-test-report.xml');
    if (fs.existsSync(sonarReportFile)) {
        const stats = fs.statSync(sonarReportFile);
        console.log(`   ✓ SonarQube test report found (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
        console.log('   ⚠️  SonarQube test report not found - run tests first');
    }
} else {
    console.log('⚠️  test-results directory does not exist');
    console.log('   This is normal if you haven\'t run tests yet');
}

console.log();

// Check 5: Environment variables
console.log('🔐 Environment Variables:');
const sonarToken = process.env.SONAR_TOKEN;
const sonarHostUrl = process.env.SONAR_HOST_URL;

if (sonarToken) {
    console.log('   ✓ SONAR_TOKEN is set');
} else {
    console.log('   ⚠️  SONAR_TOKEN not set (required for analysis)');
    console.log('      Set with: export SONAR_TOKEN="your_token"');
}

if (sonarHostUrl) {
    console.log(`   ✓ SONAR_HOST_URL is set: ${sonarHostUrl}`);
} else {
    console.log('   ⚠️  SONAR_HOST_URL not set');
    console.log('      Set with: export SONAR_HOST_URL="https://sonarcloud.io"');
}

console.log();

// Check 6: SonarScanner availability
const { execSync } = require('child_process');
try {
    const version = execSync('sonar-scanner --version', { encoding: 'utf-8', stdio: 'pipe' });
    console.log('✅ sonar-scanner is installed');
    console.log(`   ✓ ${version.split('\n')[0]}`);
} catch (err) {
    console.log('❌ sonar-scanner NOT installed');
    console.log('   macOS: brew install sonar-scanner');
    console.log('   Or download: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/');
    allChecksPass = false;
}

console.log();
console.log('═'.repeat(60));

if (allChecksPass) {
    console.log('\n✅ All checks passed! Ready for SonarQube analysis.');
    console.log('\nNext steps:');
    console.log('1. Set SONAR_TOKEN and SONAR_HOST_URL environment variables');
    console.log('2. Run: npm run test:coverage');
    console.log('3. Run: sonar-scanner');
    console.log('\nOr use: npm run sonar (runs both commands)\n');
} else {
    console.log('\n⚠️  Some checks failed. Please fix the issues above.\n');
    process.exit(1);
}

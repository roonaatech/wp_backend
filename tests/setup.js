/**
 * Global Test Setup
 *
 * This file runs before all tests to:
 * 1. Load environment variables
 * 2. Connect to test database
 * 3. Seed necessary test data (roles, users)
 * 4. Provide global cleanup after all tests
 */

require('dotenv').config();
const db = require('../models');

// Global setup - runs once before all test suites
beforeAll(async () => {
  console.log('\n🧪 Setting up test environment...\n');

  try {
    // Connect to database
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    // Check if running against correct database
    const dbName = process.env.DB_NAME;
    console.log(`📦 Using database: ${dbName}`);

    // Warning if not using a test database
    if (!dbName || !dbName.toLowerCase().includes('test')) {
      console.warn('⚠️  WARNING: Not using a test database!');
      console.warn('   Consider using a separate test database to avoid data conflicts');
    }

    // Sync database (create tables from models)
    await db.sequelize.sync({ alter: false });
    console.log('✅ Database tables synced');

    // Seed roles if they don't exist
    const seedRoles = require('../utils/seed_roles');
    await seedRoles();
    console.log('✅ Roles seeded');

    console.log('\n🚀 Test environment ready\n');
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  }
}, 30000); // 30 second timeout for setup

// Global teardown - runs once after all test suites
afterAll(async () => {
  console.log('\n🧹 Cleaning up test environment...\n');

  try {
    // Close database connection
    await db.sequelize.close();
    console.log('✅ Database connection closed');

    console.log('\n✨ Cleanup complete\n');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    // Don't throw - allow tests to complete
  }
}, 10000); // 10 second timeout for cleanup

// Increase default timeout for all tests
jest.setTimeout(10000); // 10 seconds

// Add custom matchers if needed
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);

    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid JWT token`
        : `expected ${received} to be a valid JWT token`
    };
  }
});

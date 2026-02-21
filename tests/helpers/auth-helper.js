/**
 * Authentication Helper for Testing
 *
 * Provides reusable functions for generating JWT tokens for different roles.
 * This helper ensures consistent token generation across all test suites.
 */

const jwt = require('jsonwebtoken');
const db = require('../../models');

const User = db.user;
const Role = db.roles;

// Cache for test users to avoid repeated database queries
const testUserCache = {};

/**
 * Generate a JWT token for a specific user ID
 */
function generateToken(userId) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not found in environment variables');
  }

  return jwt.sign({ id: userId }, jwtSecret, {
    expiresIn: 86400 // 24 hours
  });
}

/**
 * Find or create a test user for a specific role
 */
async function getTestUserForRole(roleName) {
  // Check cache first
  if (testUserCache[roleName]) {
    return testUserCache[roleName];
  }

  // Find role in database
  const role = await Role.findOne({ where: { name: roleName } });

  if (!role) {
    throw new Error(`Role '${roleName}' not found in database`);
  }

  // Find or create test user
  const testEmail = `test_${roleName}@workpulse.test`;
  let user = await User.findOne({ where: { email: testEmail } });

  if (!user) {
    // Create test user
    user = await User.create({
      firstname: 'Test',
      lastname: role.display_name,
      email: testEmail,
      password: 'test_password_hash', // Not used for token-based tests
      role: role.id,
      active: 1
    });
  } else {
    // Ensure user has correct role
    if (user.role !== role.id) {
      await user.update({ role: role.id });
    }
  }

  // Cache the user
  testUserCache[roleName] = user;
  return user;
}

/**
 * Get JWT token for a specific role by role name
 *
 * @param {string} roleName - Role name (e.g., 'super_admin', 'admin', 'manager', 'employee')
 * @returns {Promise<string>} JWT token
 */
async function getTokenForRole(roleName) {
  const user = await getTestUserForRole(roleName);
  return generateToken(user.staffid);
}

/**
 * Get JWT token for Super Admin role
 */
async function getSuperAdminToken() {
  return getTokenForRole('super_admin');
}

/**
 * Get JWT token for Admin role
 */
async function getAdminToken() {
  return getTokenForRole('admin');
}

/**
 * Get JWT token for HR role
 */
async function getHRToken() {
  return getTokenForRole('human_resource');
}

/**
 * Get JWT token for Manager role
 */
async function getManagerToken() {
  return getTokenForRole('manager');
}

/**
 * Get JWT token for Employee role
 */
async function getEmployeeToken() {
  return getTokenForRole('employee');
}

/**
 * Get test user for a specific role
 */
async function getUserForRole(roleName) {
  return getTestUserForRole(roleName);
}

/**
 * Clear the test user cache
 * Call this between test suites if you need fresh user data
 */
function clearUserCache() {
  Object.keys(testUserCache).forEach(key => delete testUserCache[key]);
}

/**
 * Create a custom test user with specific role and properties
 * Useful for testing edge cases
 */
async function createCustomTestUser(emailPrefix, roleName, properties = {}) {
  const role = await Role.findOne({ where: { name: roleName } });

  if (!role) {
    throw new Error(`Role '${roleName}' not found in database`);
  }

  const user = await User.create({
    firstname: properties.firstname || 'Test',
    lastname: properties.lastname || emailPrefix,
    email: properties.email || `${emailPrefix}@workpulse.test`,
    password: 'test_password_hash',
    role: role.id,
    active: properties.active !== undefined ? properties.active : 1,
    ...properties
  });

  return user;
}

/**
 * Delete a test user by email
 * Useful for cleanup in test suites
 */
async function deleteTestUser(email) {
  const user = await User.findOne({ where: { email } });

  if (user) {
    await user.destroy();

    // Remove from cache if present
    const cacheKey = Object.keys(testUserCache).find(key =>
      testUserCache[key].email === email
    );
    if (cacheKey) {
      delete testUserCache[cacheKey];
    }
  }
}

module.exports = {
  generateToken,
  getTokenForRole,
  getSuperAdminToken,
  getAdminToken,
  getHRToken,
  getManagerToken,
  getEmployeeToken,
  getUserForRole,
  getTestUserForRole,
  clearUserCache,
  createCustomTestUser,
  deleteTestUser
};

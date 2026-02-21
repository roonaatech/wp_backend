/**
 * Test Data Factory
 *
 * Provides factory functions to create test data for various entities.
 * Useful for setting up test scenarios and cleaning up after tests.
 */

const db = require('../../models');

const User = db.user;
const Role = db.roles;
const LeaveRequest = db.leave_requests;
const OnDutyLog = db.on_duty_logs;
const LeaveType = db.leave_types;
const Approval = db.approvals;

/**
 * Create a test leave request
 */
async function createLeaveRequest(userId, data = {}) {
  const defaults = {
    user_id: userId,
    leave_type: data.leave_type || 'Sick Leave',
    start_date: data.start_date || new Date(),
    end_date: data.end_date || new Date(Date.now() + 86400000), // +1 day
    reason: data.reason || 'Test leave request',
    status: data.status || 'Pending',
    days_count: data.days_count || 1
  };

  return await LeaveRequest.create({ ...defaults, ...data });
}

/**
 * Create a test on-duty log
 */
async function createOnDutyLog(userId, data = {}) {
  const defaults = {
    user_id: userId,
    client_name: data.client_name || 'Test Client',
    purpose: data.purpose || 'Test purpose',
    location: data.location || 'Test location',
    start_time: data.start_time || new Date(),
    start_lat: data.start_lat || 13.0827,
    start_long: data.start_long || 80.2707,
    status: data.status || 'Pending'
  };

  // Add end_time if provided or if status is not Active
  if (data.end_time || data.status !== 'Active') {
    defaults.end_time = data.end_time || new Date(Date.now() + 3600000); // +1 hour
    defaults.end_lat = data.end_lat || 13.0950;
    defaults.end_long = data.end_long || 80.2800;
  }

  return await OnDutyLog.create({ ...defaults, ...data });
}

/**
 * Create a test leave type
 */
async function createLeaveType(data = {}) {
  const defaults = {
    name: data.name || `Test Leave Type ${Date.now()}`,
    display_name: data.display_name || `Test Leave ${Date.now()}`,
    description: data.description || 'Test leave type description',
    default_days: data.default_days || 10,
    is_active: data.is_active !== undefined ? data.is_active : true,
    requires_approval: data.requires_approval !== undefined ? data.requires_approval : true,
    gender_specific: data.gender_specific || 'all'
  };

  return await LeaveType.create({ ...defaults, ...data });
}

/**
 * Create a test approval record
 */
async function createApproval(data = {}) {
  const defaults = {
    attendance_log_id: data.attendance_log_id,
    on_duty_log_id: data.on_duty_log_id,
    manager_id: data.manager_id,
    status: data.status || 'pending',
    comments: data.comments
  };

  return await Approval.create({ ...defaults, ...data });
}

/**
 * Create multiple leave requests for a user
 */
async function createMultipleLeaveRequests(userId, count = 3, status = 'Pending') {
  const requests = [];

  for (let i = 0; i < count; i++) {
    const request = await createLeaveRequest(userId, {
      start_date: new Date(Date.now() + i * 86400000), // Stagger by days
      end_date: new Date(Date.now() + (i + 1) * 86400000),
      status,
      reason: `Test leave request ${i + 1}`
    });
    requests.push(request);
  }

  return requests;
}

/**
 * Create multiple on-duty logs for a user
 */
async function createMultipleOnDutyLogs(userId, count = 3, status = 'Pending') {
  const logs = [];

  for (let i = 0; i < count; i++) {
    const log = await createOnDutyLog(userId, {
      start_time: new Date(Date.now() + i * 3600000), // Stagger by hours
      status,
      client_name: `Test Client ${i + 1}`
    });
    logs.push(log);
  }

  return logs;
}

/**
 * Delete all test leave requests for a user
 */
async function cleanupLeaveRequests(userId) {
  await LeaveRequest.destroy({ where: { user_id: userId } });
}

/**
 * Delete all test on-duty logs for a user
 */
async function cleanupOnDutyLogs(userId) {
  await OnDutyLog.destroy({ where: { user_id: userId } });
}

/**
 * Delete all test approvals for a user
 */
async function cleanupApprovals(managerId) {
  await Approval.destroy({ where: { manager_id: managerId } });
}

/**
 * Delete a specific leave type
 */
async function cleanupLeaveType(leaveTypeId) {
  await LeaveType.destroy({ where: { id: leaveTypeId } });
}

/**
 * Comprehensive cleanup for a test user
 * Removes all associated data (leaves, on-duty logs, approvals)
 */
async function cleanupUserData(userId) {
  await cleanupLeaveRequests(userId);
  await cleanupOnDutyLogs(userId);
  await cleanupApprovals(userId);
}

/**
 * Get a user's subordinates (for testing manager permissions)
 * This is a simplified version - in production you'd query the user table
 */
async function getSubordinates(managerId) {
  // In a real implementation, this would query users where manager_id = managerId
  // For testing, we can create mock subordinates
  return await User.findAll({
    where: {
      // Add manager_id field check if it exists in your schema
      active: true
    },
    limit: 5 // Return max 5 for testing
  });
}

/**
 * Create a complete test scenario with user, leaves, and on-duty logs
 */
async function createTestScenario(roleName, options = {}) {
  const { createCustomTestUser } = require('./auth-helper');

  // Create test user
  const emailPrefix = options.emailPrefix || `test_scenario_${Date.now()}`;
  const user = await createCustomTestUser(emailPrefix, roleName, options.userProperties);

  // Create leave requests if specified
  const leaveRequests = options.leaveCount
    ? await createMultipleLeaveRequests(user.staffid, options.leaveCount, options.leaveStatus)
    : [];

  // Create on-duty logs if specified
  const onDutyLogs = options.onDutyCount
    ? await createMultipleOnDutyLogs(user.staffid, options.onDutyCount, options.onDutyStatus)
    : [];

  return {
    user,
    leaveRequests,
    onDutyLogs
  };
}

/**
 * Cleanup a complete test scenario
 */
async function cleanupTestScenario(user) {
  const { deleteTestUser } = require('./auth-helper');

  // Cleanup user data
  await cleanupUserData(user.staffid);

  // Delete user
  await deleteTestUser(user.email);
}

module.exports = {
  // Create functions
  createLeaveRequest,
  createOnDutyLog,
  createLeaveType,
  createApproval,
  createMultipleLeaveRequests,
  createMultipleOnDutyLogs,

  // Cleanup functions
  cleanupLeaveRequests,
  cleanupOnDutyLogs,
  cleanupApprovals,
  cleanupLeaveType,
  cleanupUserData,

  // Utility functions
  getSubordinates,

  // Scenario functions
  createTestScenario,
  cleanupTestScenario
};

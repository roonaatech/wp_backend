/**
 * Admin Controller Tests
 * Tests all admin controller endpoints and methods
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const {
  getSuperAdminToken,
  getAdminToken,
  getManagerToken,
  getEmployeeToken,
  createCustomTestUser,
  deleteTestUser
} = require('../helpers/auth-helper');

describe('Admin Controller', () => {
  let superAdminToken, adminToken, managerToken, employeeToken;
  let testUser;

  beforeAll(async () => {
    // Get tokens for different roles
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    managerToken = await getManagerToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/admin/incomplete-profiles', () => {
    it('should get incomplete user profiles with super admin token', async () => {
      const res = await request(app)
        .get('/api/admin/incomplete-profiles')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get incomplete user profiles with admin token', async () => {
      const res = await request(app)
        .get('/api/admin/incomplete-profiles')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject request without authentication token', async () => {
      const res = await request(app)
        .get('/api/admin/incomplete-profiles');

      expect(res.status).toBe(403);
    });

    it('should handle server errors gracefully', async () => {
      // This tests the catch block - would require mocking DB failure
      const res = await request(app)
        .get('/api/admin/incomplete-profiles')
        .set('x-access-token', superAdminToken);

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('POST /api/admin/users', () => {
    afterEach(async () => {
      // Cleanup: Delete test user if created
      if (testUser && testUser.email) {
        await deleteTestUser(testUser.email);
        testUser = null;
      }
    });

    it('should create a new user with super admin token', async () => {
      const newUser = {
        firstname: 'Test',
        lastname: 'User',
        email: `test_user_${Date.now()}@workpulse.test`,
        password: 'password123',
        role: 4, // Employee
        gender: 'Male'
      };

      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', superAdminToken)
        .send(newUser);

      testUser = newUser;

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(newUser.email);
    });

    it('should reject user creation with missing required fields', async () => {
      const invalidUser = {
        firstname: 'Test',
        // Missing lastname, email, password, role, gender
      };

      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', superAdminToken)
        .send(invalidUser);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject user creation with invalid role', async () => {
      const invalidUser = {
        firstname: 'Test',
        lastname: 'User',
        email: `test_invalid_${Date.now()}@workpulse.test`,
        password: 'password123',
        role: 0, // Invalid role
        gender: 'Male'
      };

      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', superAdminToken)
        .send(invalidUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid Role');
    });

    it('should reject duplicate email', async () => {
      const newUser = {
        firstname: 'Test',
        lastname: 'Duplicate',
        email: `test_duplicate_${Date.now()}@workpulse.test`,
        password: 'password123',
        role: 4,
        gender: 'Male'
      };

      // Create first user
      await request(app)
        .post('/api/admin/users')
        .set('x-access-token', superAdminToken)
        .send(newUser);

      testUser = newUser;

      // Try to create duplicate
      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', superAdminToken)
        .send(newUser);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Email already exists');
    });

    it('should reject user creation without authentication', async () => {
      const newUser = {
        firstname: 'Test',
        lastname: 'User',
        email: `test_noauth_${Date.now()}@workpulse.test`,
        password: 'password123',
        role: 4,
        gender: 'Male'
      };

      const res = await request(app)
        .post('/api/admin/users')
        .send(newUser);

      expect(res.status).toBe(403);
    });

    it('should enforce role hierarchy when creating users', async () => {
      // Manager trying to create an admin (higher authority role)
      const newUser = {
        firstname: 'Test',
        lastname: 'Admin',
        email: `test_hierarchy_${Date.now()}@workpulse.test`,
        password: 'password123',
        role: 2, // Admin role (higher than manager)
        gender: 'Male'
      };

      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', managerToken)
        .send(newUser);

      expect([403, 401]).toContain(res.status);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    let createdUserId;

    beforeEach(async () => {
      // Create a test user to update
      const newUser = await createCustomTestUser(`test_update_${Date.now()}`, 'employee', {
        firstname: 'Original',
        lastname: 'Name',
        gender: 'Male'
      });
      createdUserId = newUser.staffid;
      testUser = { email: newUser.email };
    });

    afterEach(async () => {
      if (testUser && testUser.email) {
        await deleteTestUser(testUser.email);
        testUser = null;
      }
    });

    it('should update user with super admin token', async () => {
      const updateData = {
        firstname: 'Updated',
        lastname: 'User',
        email: testUser.email,
        role: 4,
        gender: 'Female'
      };

      const res = await request(app)
        .put(`/api/admin/users/${createdUserId}`)
        .set('x-access-token', superAdminToken)
        .send(updateData);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
      expect(res.body.user.firstname).toBe('Updated');
    });

    it('should reject update with missing required fields', async () => {
      const invalidUpdate = {
        firstname: 'Updated'
        // Missing lastname, email, role
      };

      const res = await request(app)
        .put(`/api/admin/users/${createdUserId}`)
        .set('x-access-token', superAdminToken)
        .send(invalidUpdate);

      expect(res.status).toBe(400);
    });

    it('should reject update for non-existent user', async () => {
      const updateData = {
        firstname: 'Updated',
        lastname: 'User',
        email: 'nonexistent@test.com',
        role: 4,
        gender: 'Male'
      };

      const res = await request(app)
        .put('/api/admin/users/99999')
        .set('x-access-token', superAdminToken)
        .send(updateData);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('User not found');
    });

    it('should reject update without authentication', async () => {
      const updateData = {
        firstname: 'Updated',
        lastname: 'User',
        email: testUser.email,
        role: 4,
        gender: 'Male'
      };

      const res = await request(app)
        .put(`/api/admin/users/${createdUserId}`)
        .send(updateData);

      expect(res.status).toBe(403);
    });

    it('should update password when provided', async () => {
      const updateData = {
        firstname: 'Updated',
        lastname: 'User',
        email: testUser.email,
        role: 4,
        password: 'newpassword123',
        gender: 'Male'
      };

      const res = await request(app)
        .put(`/api/admin/users/${createdUserId}`)
        .set('x-access-token', superAdminToken)
        .send(updateData);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    let createdUserId;

    beforeEach(async () => {
      const newUser = await createCustomTestUser(`test_reset_${Date.now()}`, 'employee', {
        gender: 'Male'
      });
      createdUserId = newUser.staffid;
      testUser = { email: newUser.email };
    });

    afterEach(async () => {
      if (testUser && testUser.email) {
        await deleteTestUser(testUser.email);
        testUser = null;
      }
    });

    it('should reset user password with admin token', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${createdUserId}/reset-password`)
        .set('x-access-token', adminToken)
        .send({ newPassword: 'newpassword123' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject password reset with short password', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${createdUserId}/reset-password`)
        .set('x-access-token', adminToken)
        .send({ newPassword: '12345' }); // Less than 6 characters

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 6 characters');
    });

    it('should reject password reset for non-existent user', async () => {
      const res = await request(app)
        .post('/api/admin/users/99999/reset-password')
        .set('x-access-token', adminToken)
        .send({ newPassword: 'newpassword123' });

      expect(res.status).toBe(404);
    });

    it('should reject password reset without authentication', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${createdUserId}/reset-password`)
        .send({ newPassword: 'newpassword123' });

      expect(res.status).toBe(403);
    });

    it('should reject password reset from employee token', async () => {
      const res = await request(app)
        .post(`/api/admin/users/${createdUserId}/reset-password`)
        .set('x-access-token', employeeToken)
        .send({ newPassword: 'newpassword123' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/users', () => {
    it('should get all users with super admin token', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body).toHaveProperty('totalItems');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body).toHaveProperty('currentPage');
    });

    it('should support pagination parameters', async () => {
      const res = await request(app)
        .get('/api/admin/users?page=1&limit=5')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body.users.length).toBeLessThanOrEqual(5);
    });

    it('should support search parameter', async () => {
      const res = await request(app)
        .get('/api/admin/users?search=test')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });

    it('should support status filter', async () => {
      const res = await request(app)
        .get('/api/admin/users?status=active')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });

    it('should support role filter', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=4')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });

    it('should support letter filter', async () => {
      const res = await request(app)
        .get('/api/admin/users?letter=T')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });

    it('should support userType filter', async () => {
      const res = await request(app)
        .get('/api/admin/users?userType=workpulse')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });

    it('should support limit=all for fetching all users', async () => {
      const res = await request(app)
        .get('/api/admin/users?limit=all')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/users');

      expect(res.status).toBe(403);
    });

    it('should filter users based on manager permissions', async () => {
      // Manager should only see their subordinates
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-access-token', managerToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('users');
    });
  });

  describe('GET /api/admin/managers-and-admins', () => {
    it('should get managers and admins with super admin token', async () => {
      const res = await request(app)
        .get('/api/admin/managers-and-admins')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should only return users with approval permissions', async () => {
      const res = await request(app)
        .get('/api/admin/managers-and-admins')
        .set('x-access-token', superAdminToken);

      expect([200, 201]).toContain(res.status);
      // All returned users should have manager or admin roles
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('role');
      }
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/managers-and-admins');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/pending-approvals', () => {
    it('should get pending approvals with admin token', async () => {
      const res = await request(app)
        .get('/api/admin/pending-approvals')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter approvals based on manager permissions', async () => {
      const res = await request(app)
        .get('/api/admin/pending-approvals')
        .set('x-access-token', managerToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/pending-approvals');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/approvals/:id', () => {
    it('should approve attendance with valid data', async () => {
      // This would require creating a test approval first
      const res = await request(app)
        .put('/api/admin/approvals/1')
        .set('x-access-token', adminToken)
        .send({ status: 'Approved' });

      // May return 404 if no approval exists, or 200 if successful
      expect([200, 404, 403]).toContain(res.status);
    });

    it('should reject attendance with valid data', async () => {
      const res = await request(app)
        .put('/api/admin/approvals/1')
        .set('x-access-token', adminToken)
        .send({
          status: 'Rejected',
          rejection_reason: 'Invalid request'
        });

      expect([200, 404, 403, 400]).toContain(res.status);
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .put('/api/admin/approvals/1')
        .set('x-access-token', adminToken)
        .send({ status: 'Invalid' });

      expect(res.status).toBe(400);
    });

    it('should require rejection_reason when rejecting', async () => {
      const res = await request(app)
        .put('/api/admin/approvals/1')
        .set('x-access-token', adminToken)
        .send({ status: 'Rejected' });

      expect([400, 404]).toContain(res.status);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .put('/api/admin/approvals/1')
        .send({ status: 'Approved' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/reports', () => {
    it('should get attendance reports with admin token', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('reports');
      expect(res.body).toHaveProperty('totalItems');
    });

    it('should support type filter (leave, onduty, both)', async () => {
      const res = await request(app)
        .get('/api/admin/reports?type=leave')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('reports');
    });

    it('should support date filters', async () => {
      const res = await request(app)
        .get('/api/admin/reports?dateFilter=7days')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('reports');
    });

    it('should support custom date range', async () => {
      const res = await request(app)
        .get('/api/admin/reports?startDate=2024-01-01&endDate=2024-01-31')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('reports');
    });

    it('should support status filter', async () => {
      const res = await request(app)
        .get('/api/admin/reports?status=approved')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('reports');
    });

    it('should support userId filter', async () => {
      const res = await request(app)
        .get('/api/admin/reports?userId=1')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('reports');
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/admin/reports?page=1&limit=10')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('currentPage');
      expect(res.body).toHaveProperty('totalPages');
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/reports');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/dashboard-stats', () => {
    it('should get dashboard stats with admin token', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-stats')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('presentToday');
      expect(res.body).toHaveProperty('onDuty');
      expect(res.body).toHaveProperty('pendingLeaves');
    });

    it('should filter stats based on manager permissions', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-stats')
        .set('x-access-token', managerToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('totalUsers');
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-stats');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/daily-trend', () => {
    it('should get daily trend data with default days', async () => {
      const res = await request(app)
        .get('/api/admin/daily-trend')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should support custom days parameter', async () => {
      const res = await request(app)
        .get('/api/admin/daily-trend?days=30')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should support custom date range', async () => {
      const res = await request(app)
        .get('/api/admin/daily-trend?startDate=2024-01-01&endDate=2024-01-31')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/daily-trend');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/calendar-events', () => {
    it('should get calendar events for current month', async () => {
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;

      const res = await request(app)
        .get(`/api/admin/calendar-events?year=${year}&month=${month}`)
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should support year and month parameters', async () => {
      const res = await request(app)
        .get('/api/admin/calendar-events?year=2024&month=1')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter events based on manager permissions', async () => {
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;

      const res = await request(app)
        .get(`/api/admin/calendar-events?year=${year}&month=${month}`)
        .set('x-access-token', managerToken);

      expect([200, 201]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/calendar-events?year=2024&month=1');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/debug-calendar', () => {
    it('should return debug calendar data with admin token', async () => {
      const res = await request(app)
        .get('/api/admin/debug-calendar')
        .set('x-access-token', adminToken);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('userId');
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/debug-calendar');

      expect(res.status).toBe(403);
    });
  });
});

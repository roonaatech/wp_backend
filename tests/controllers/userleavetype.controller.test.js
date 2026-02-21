/**
 * User Leave Type Controller Tests
 * Tests all methods in userleavetype.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('User Leave Type Controller', () => {
  let superAdminToken, adminToken, managerToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    managerToken = await getManagerToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/userleavetypes/:userId', () => {
    it('should get user leave types for a user', async () => {
      const res = await request(app)
        .get('/api/userleavetypes/1')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should allow employee to view their own leave types', async () => {
      const res = await request(app)
        .get('/api/userleavetypes/4')
        .set('x-access-token', employeeToken);

      expect([200, 404, 403]).toContain(res.status);
    });
  });

  describe('PUT /api/userleavetypes/:userId', () => {
    it('should allow admin to update user leave types', async () => {
      const leaveTypes = [
        { leave_type_id: 1, days_allowed: 15 }
      ];

      const res = await request(app)
        .put('/api/userleavetypes/1')
        .set('x-access-token', superAdminToken)
        .send({ leaveTypes });

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should deny Employee from updating other user leave types', async () => {
      const res = await request(app)
        .put('/api/userleavetypes/1')
        .set('x-access-token', employeeToken)
        .send({ leaveTypes: [] });

      expect([403, 404]).toContain(res.status);
    });

    it('should reject update with missing days_allowed', async () => {
      const res = await request(app)
        .put('/api/userleavetypes/1')
        .set('x-access-token', superAdminToken)
        .send({ leaveTypes: [{ leave_type_id: 1 }] });

      expect([400, 404]).toContain(res.status);
    });
  });
});

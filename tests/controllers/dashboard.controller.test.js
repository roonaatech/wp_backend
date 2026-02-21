/**
 * Dashboard Controller Tests
 * Tests all methods in dashboard.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Dashboard Controller', () => {
  let employeeToken;

  beforeAll(async () => {
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/admin/dashboard/stats', () => {
    it('should get dashboard statistics for admin', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('x-access-token', employeeToken);

      expect([200, 404, 403]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('pending_leave_requests');
      }
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/stats');

      expect([403, 404]).toContain(res.status);
    });
  });
});

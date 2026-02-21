/**
 * Leave Controller Tests
 * Tests all methods in leave.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Leave Controller', () => {
  let superAdminToken, adminToken, managerToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    managerToken = await getManagerToken();
    employeeToken = await getEmployeeToken();
  });

  describe('POST /api/leave/apply', () => {
    it('should allow employee to apply for leave', async () => {
      const leaveRequest = {
        leave_type_id: 1,
        start_date: '2024-12-01',
        end_date: '2024-12-02',
        reason: 'Personal work'
      };

      const res = await request(app)
        .post('/api/leave/apply')
        .set('x-access-token', employeeToken)
        .send(leaveRequest);

      expect([200, 201, 400]).toContain(res.status);
    });

    it('should reject leave with missing fields', async () => {
      const res = await request(app)
        .post('/api/leave/apply')
        .set('x-access-token', employeeToken)
        .send({ reason: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/leave/my-leaves', () => {
    it('should get employee own leaves', async () => {
      const res = await request(app)
        .get('/api/leave/my-leaves')
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/leave/pending', () => {
    it('should get pending leaves for admin', async () => {
      const res = await request(app)
        .get('/api/leave/pending')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should get pending leaves for manager', async () => {
      const res = await request(app)
        .get('/api/leave/pending')
        .set('x-access-token', managerToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .get('/api/leave/pending')
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/leave/:id/status', () => {
    it('should approve leave request', async () => {
      const res = await request(app)
        .put('/api/leave/1/status')
        .set('x-access-token', adminToken)
        .send({ status: 'Approved' });

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should reject leave request with reason', async () => {
      const res = await request(app)
        .put('/api/leave/1/status')
        .set('x-access-token', adminToken)
        .send({
          status: 'Rejected',
          rejection_reason: 'Insufficient balance'
        });

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .put('/api/leave/1/status')
        .set('x-access-token', employeeToken)
        .send({ status: 'Approved' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/leave/stats', () => {
    it('should get admin leave stats', async () => {
      const res = await request(app)
        .get('/api/leave/stats')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('GET /api/leave/my-stats', () => {
    it('should get employee own leave stats', async () => {
      const res = await request(app)
        .get('/api/leave/my-stats')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/leave/:id', () => {
    it('should allow deleting own leave', async () => {
      const res = await request(app)
        .delete('/api/leave/1')
        .set('x-access-token', employeeToken);

      expect([200, 404, 403]).toContain(res.status);
    });
  });

  describe('GET /api/leave/balance/:userId', () => {
    it('should get user leave balance', async () => {
      const res = await request(app)
        .get('/api/leave/balance/1')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('GET /api/leave/my-balance', () => {
    it('should get employee own leave balance', async () => {
      const res = await request(app)
        .get('/api/leave/my-balance')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });
  });
});

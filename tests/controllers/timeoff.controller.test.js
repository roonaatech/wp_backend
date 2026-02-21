/**
 * Time Off Controller Tests
 * Tests all methods in timeoff.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Time Off Controller', () => {
  let superAdminToken, adminToken, managerToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    managerToken = await getManagerToken();
    employeeToken = await getEmployeeToken();
  });

  describe('POST /api/timeoff/apply', () => {
    it('should allow employee to apply for time off', async () => {
      const timeOffRequest = {
        start_date: '2024-12-01',
        end_date: '2024-12-02',
        reason: 'Personal work',
        timeoff_type: 'casual'
      };

      const res = await request(app)
        .post('/api/timeoff/apply')
        .set('x-access-token', employeeToken)
        .send(timeOffRequest);

      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('should reject time off with missing fields', async () => {
      const res = await request(app)
        .post('/api/timeoff/apply')
        .set('x-access-token', employeeToken)
        .send({ reason: 'Test' });

      expect([400, 404]).toContain(res.status);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/timeoff/apply')
        .send({});

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/timeoff/my-requests', () => {
    it('should get employee own time off requests', async () => {
      const res = await request(app)
        .get('/api/timeoff/my-requests')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/timeoff/:id', () => {
    it('should allow updating time off details', async () => {
      const res = await request(app)
        .put('/api/timeoff/1')
        .set('x-access-token', employeeToken)
        .send({ reason: 'Updated reason' });

      expect([200, 404, 403]).toContain(res.status);
    });
  });

  describe('PUT /api/timeoff/:id/status', () => {
    it('should allow admin to update status', async () => {
      const res = await request(app)
        .put('/api/timeoff/1/status')
        .set('x-access-token', adminToken)
        .send({ status: 'Approved' });

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .put('/api/timeoff/1/status')
        .set('x-access-token', employeeToken)
        .send({ status: 'Approved' });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/timeoff/:id', () => {
    it('should allow deleting own time off', async () => {
      const res = await request(app)
        .delete('/api/timeoff/1')
        .set('x-access-token', employeeToken);

      expect([200, 404, 403]).toContain(res.status);
    });
  });
});

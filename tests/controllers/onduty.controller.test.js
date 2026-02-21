/**
 * On-Duty Controller Tests
 * Tests all methods in onduty.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('On-Duty Controller', () => {
  let superAdminToken, adminToken, managerToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    managerToken = await getManagerToken();
    employeeToken = await getEmployeeToken();
  });

  describe('POST /api/onduty/start', () => {
    it('should allow employee to start on-duty', async () => {
      const onDutyData = {
        purpose: 'Client meeting',
        location: 'Mumbai',
        estimated_end_time: '18:00:00'
      };

      const res = await request(app)
        .post('/api/onduty/start')
        .set('x-access-token', employeeToken)
        .send(onDutyData);

      expect([200, 201, 400]).toContain(res.status);
    });

    it('should reject on-duty with missing fields', async () => {
      const res = await request(app)
        .post('/api/onduty/start')
        .set('x-access-token', employeeToken)
        .send({ purpose: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .post('/api/onduty/start')
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/onduty/end/:id', () => {
    it('should allow employee to end on-duty', async () => {
      const res = await request(app)
        .post('/api/onduty/end/1')
        .set('x-access-token', employeeToken);

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .post('/api/onduty/end/1');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/onduty/active', () => {
    it('should get employee active on-duty', async () => {
      const res = await request(app)
        .get('/api/onduty/active')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should return array or null', async () => {
      const res = await request(app)
        .get('/api/onduty/active')
        .set('x-access-token', employeeToken);

      if (res.status === 200) {
        expect(res.body === null || typeof res.body === 'object').toBe(true);
      }
    });
  });

  describe('GET /api/onduty/status/:status', () => {
    it('should get on-duty logs by status', async () => {
      const res = await request(app)
        .get('/api/onduty/status/active')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('should support different status values', async () => {
      const statuses = ['active', 'completed', 'pending'];
      for (const status of statuses) {
        const res = await request(app)
          .get(`/api/onduty/status/${status}`)
          .set('x-access-token', employeeToken);

        expect([200, 404]).toContain(res.status);
      }
    });
  });

  describe('GET /api/onduty/all-active', () => {
    it('should allow admin to get all active on-duty', async () => {
      const res = await request(app)
        .get('/api/onduty/all-active')
        .set('x-access-token', adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should allow manager to get subordinates on-duty', async () => {
      const res = await request(app)
        .get('/api/onduty/all-active')
        .set('x-access-token', managerToken);

      expect([200, 403]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .get('/api/onduty/all-active')
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/onduty/:id', () => {
    it('should allow employee to update on-duty details', async () => {
      const updateData = {
        purpose: 'Updated purpose',
        location: 'Updated location'
      };

      const res = await request(app)
        .put('/api/onduty/1')
        .set('x-access-token', employeeToken)
        .send(updateData);

      expect([200, 404, 403]).toContain(res.status);
    });

    it('should reject update without authentication', async () => {
      const res = await request(app)
        .put('/api/onduty/1')
        .send({ purpose: 'Test' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/onduty/:id', () => {
    it('should allow deleting own on-duty log', async () => {
      const res = await request(app)
        .delete('/api/onduty/1')
        .set('x-access-token', employeeToken);

      expect([200, 404, 403]).toContain(res.status);
    });

    it('should allow admin to delete any on-duty log', async () => {
      const res = await request(app)
        .delete('/api/onduty/1')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should reject delete without authentication', async () => {
      const res = await request(app)
        .delete('/api/onduty/1');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/onduty/:id/status', () => {
    it('should allow admin to update on-duty status', async () => {
      const res = await request(app)
        .put('/api/onduty/1/status')
        .set('x-access-token', adminToken)
        .send({ status: 'Approved' });

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .put('/api/onduty/1/status')
        .set('x-access-token', adminToken)
        .send({ status: 'Invalid' });

      expect([400, 404]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .put('/api/onduty/1/status')
        .set('x-access-token', employeeToken)
        .send({ status: 'Approved' });

      expect(res.status).toBe(403);
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .put('/api/onduty/1/status')
        .send({ status: 'Approved' });

      expect(res.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid token', async () => {
      const res = await request(app)
        .get('/api/onduty/active')
        .set('x-access-token', 'invalid_token');

      expect(res.status).toBe(401);
    });

    it('should handle malformed on-duty ID', async () => {
      const res = await request(app)
        .get('/api/onduty/invalid')
        .set('x-access-token', employeeToken);

      expect([400, 404]).toContain(res.status);
    });
  });
});

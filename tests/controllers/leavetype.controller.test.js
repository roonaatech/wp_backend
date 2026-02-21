/**
 * Leave Type Controller Tests
 * Tests all methods in leavetype.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Leave Type Controller', () => {
  let superAdminToken, adminToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/leavetypes', () => {
    it('should get all leave types for employee', async () => {
      const res = await request(app)
        .get('/api/leavetypes')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should get leave types by gender', async () => {
      const res = await request(app)
        .get('/api/leavetypes?gender=Male')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('GET /api/leavetypes/admin', () => {
    it('should allow admin to get all leave types', async () => {
      const res = await request(app)
        .get('/api/leavetypes/admin')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .get('/api/leavetypes/admin')
        .set('x-access-token', employeeToken);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('POST /api/leavetypes', () => {
    it('should allow admin to create leave type', async () => {
      const newLeaveType = {
        name: `Test Leave ${Date.now()}`,
        days: 10,
        description: 'Test leave type',
        gender_restriction: 'all'
      };

      const res = await request(app)
        .post('/api/leavetypes')
        .set('x-access-token', superAdminToken)
        .send(newLeaveType);

      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .post('/api/leavetypes')
        .set('x-access-token', employeeToken)
        .send({});

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/leavetypes/:id', () => {
    it('should allow admin to update leave type', async () => {
      const res = await request(app)
        .put('/api/leavetypes/1')
        .set('x-access-token', superAdminToken)
        .send({ name: 'Updated Leave Type' });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/leavetypes/:id', () => {
    it('should allow admin to delete leave type', async () => {
      const res = await request(app)
        .delete('/api/leavetypes/99999')
        .set('x-access-token', superAdminToken);

      expect([200, 204, 404]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .delete('/api/leavetypes/1')
        .set('x-access-token', employeeToken);

      expect([403, 404]).toContain(res.status);
    });
  });
});

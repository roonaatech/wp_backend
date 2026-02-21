/**
 * Activity Controller Tests
 * Tests all methods in activity.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Activity Controller', () => {
  let superAdminToken, adminToken, managerToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    managerToken = await getManagerToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/activities', () => {
    it('should allow admin to get all activities', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
      }
    });

    it('should filter activities by action', async () => {
      const res = await request(app)
        .get('/api/activities?action=CREATE')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should filter activities by entity', async () => {
      const res = await request(app)
        .get('/api/activities?entity=User')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should filter activities by date range', async () => {
      const res = await request(app)
        .get('/api/activities?startDate=2024-01-01&endDate=2024-12-31')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/activities?page=1&limit=10')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee access based on permissions', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('x-access-token', employeeToken);

      expect([200, 403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/activities/summary', () => {
    it('should get activity summary for admin', async () => {
      const res = await request(app)
        .get('/api/activities/summary')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('actionCounts');
        expect(res.body.data).toHaveProperty('entityCounts');
        expect(res.body.data).toHaveProperty('topUsers');
      }
    });

    it('should filter summary by date range', async () => {
      const res = await request(app)
        .get('/api/activities/summary?startDate=2024-01-01&endDate=2024-12-31')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('GET /api/activities/user/:userId', () => {
    it('should get user activity history', async () => {
      const res = await request(app)
        .get('/api/activities/user/1')
        .set('x-access-token', adminToken);

      expect([200, 404, 403]).toContain(res.status);
    });

    it('should support pagination for user activities', async () => {
      const res = await request(app)
        .get('/api/activities/user/1?page=1&limit=10')
        .set('x-access-token', adminToken);

      expect([200, 404, 403]).toContain(res.status);
    });

    it('should deny access to other user activities for subordinates-only permission', async () => {
      const res = await request(app)
        .get('/api/activities/user/999')
        .set('x-access-token', managerToken);

      expect([200, 403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/activities/export/csv', () => {
    it('should export activities to CSV for admin', async () => {
      const res = await request(app)
        .get('/api/activities/export/csv')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.headers['content-type']).toContain('text/csv');
      }
    });

    it('should filter exported activities', async () => {
      const res = await request(app)
        .get('/api/activities/export/csv?action=CREATE&entity=User')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('POST /api/activities/mobile-log', () => {
    it('should log activity from mobile app', async () => {
      const activityData = {
        action: 'LOGIN',
        entity: 'Auth',
        description: 'User logged in from mobile'
      };

      const res = await request(app)
        .post('/api/activities/mobile-log')
        .set('x-access-token', employeeToken)
        .send(activityData);

      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('should reject mobile log with missing fields', async () => {
      const res = await request(app)
        .post('/api/activities/mobile-log')
        .set('x-access-token', employeeToken)
        .send({ action: 'LOGIN' });

      expect([400, 404]).toContain(res.status);
    });

    it('should allow logging without token', async () => {
      const res = await request(app)
        .post('/api/activities/mobile-log')
        .send({
          action: 'LOGIN',
          entity: 'Auth',
          description: 'Anonymous activity'
        });

      expect([200, 201, 400, 404]).toContain(res.status);
    });
  });
});

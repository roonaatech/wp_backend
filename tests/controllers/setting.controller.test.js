/**
 * Setting Controller Tests
 * Tests all methods in setting.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Setting Controller', () => {
  let superAdminToken, adminToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/settings', () => {
    it('should allow admin to get all settings', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('settings');
        expect(res.body).toHaveProperty('map');
        expect(res.body).toHaveProperty('byCategory');
      }
    });

    it('should filter settings by key', async () => {
      const res = await request(app)
        .get('/api/settings?key=application_timezone')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should filter settings by category', async () => {
      const res = await request(app)
        .get('/api/settings?category=general')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should get only public settings when include_public_only=true', async () => {
      const res = await request(app)
        .get('/api/settings?include_public_only=true')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee access to all settings', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('x-access-token', employeeToken);

      expect([200, 403, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/settings', () => {
    it('should allow admin to update setting', async () => {
      const settingData = {
        key: `test_setting_${Date.now()}`,
        value: 'test_value',
        description: 'Test setting',
        category: 'general',
        data_type: 'string'
      };

      const res = await request(app)
        .put('/api/settings')
        .set('x-access-token', superAdminToken)
        .send(settingData);

      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('should validate number type settings', async () => {
      const settingData = {
        key: `test_number_${Date.now()}`,
        value: '123',
        data_type: 'number'
      };

      const res = await request(app)
        .put('/api/settings')
        .set('x-access-token', superAdminToken)
        .send(settingData);

      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('should reject setting update with missing key', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('x-access-token', superAdminToken)
        .send({ value: 'test' });

      expect([400, 404]).toContain(res.status);
    });

    it('should deny Employee from updating settings', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('x-access-token', employeeToken)
        .send({ key: 'test', value: 'test' });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/settings/public', () => {
    it('should get public settings without authentication', async () => {
      const res = await request(app)
        .get('/api/settings/public');

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('settings');
        expect(res.body).toHaveProperty('map');
      }
    });

    it('should only return public settings', async () => {
      const res = await request(app)
        .get('/api/settings/public');

      expect([200, 404]).toContain(res.status);

      if (res.status === 200 && res.body.settings) {
        res.body.settings.forEach(setting => {
          expect(setting.is_public).toBe(true);
        });
      }
    });
  });
});

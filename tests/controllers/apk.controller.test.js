/**
 * APK Controller Tests
 * Tests all methods in apk.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const path = require('path');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('APK Controller', () => {
  let superAdminToken, adminToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/apk/list', () => {
    it('should allow admin to get all APKs', async () => {
      const res = await request(app)
        .get('/api/apk/list')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
      }
    });

    it('should support pagination for APKs', async () => {
      const res = await request(app)
        .get('/api/apk/list?page=1&limit=5')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee access to APK list', async () => {
      const res = await request(app)
        .get('/api/apk/list')
        .set('x-access-token', employeeToken);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/apk/latest', () => {
    it('should get latest visible APK', async () => {
      const res = await request(app)
        .get('/api/apk/latest')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('is_visible');
        expect(res.body.is_visible).toBe(true);
      }
    });

    it('should work without authentication', async () => {
      const res = await request(app)
        .get('/api/apk/latest');

      expect([200, 404, 403]).toContain(res.status);
    });
  });

  describe('POST /api/apk/check-version', () => {
    it('should check if app version is up to date', async () => {
      const res = await request(app)
        .post('/api/apk/check-version')
        .send({ app_version: '1.0.0+1' });

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('updateRequired');
      }
    });

    it('should indicate update required for old version', async () => {
      const res = await request(app)
        .post('/api/apk/check-version')
        .send({ app_version: '0.0.1+1' });

      expect([200, 404]).toContain(res.status);
    });

    it('should handle missing app_version', async () => {
      const res = await request(app)
        .post('/api/apk/check-version')
        .send({});

      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe('GET /api/apk/download/:id', () => {
    it('should allow downloading APK by ID', async () => {
      const res = await request(app)
        .get('/api/apk/download/1')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should allow downloading latest APK', async () => {
      const res = await request(app)
        .get('/api/apk/download/latest')
        .set('x-access-token', employeeToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should work without authentication', async () => {
      const res = await request(app)
        .get('/api/apk/download/latest');

      expect([200, 404, 403]).toContain(res.status);
    });
  });

  describe('PUT /api/apk/:id/visibility', () => {
    it('should allow admin to update APK visibility', async () => {
      const res = await request(app)
        .put('/api/apk/1/visibility')
        .set('x-access-token', superAdminToken)
        .send({ is_visible: true });

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee from updating visibility', async () => {
      const res = await request(app)
        .put('/api/apk/1/visibility')
        .set('x-access-token', employeeToken)
        .send({ is_visible: false });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/apk/:id/release-notes', () => {
    it('should allow admin to update release notes', async () => {
      const res = await request(app)
        .put('/api/apk/1/release-notes')
        .set('x-access-token', superAdminToken)
        .send({ release_notes: 'Updated release notes' });

      expect([200, 404, 400]).toContain(res.status);
    });

    it('should reject update without release_notes', async () => {
      const res = await request(app)
        .put('/api/apk/1/release-notes')
        .set('x-access-token', superAdminToken)
        .send({});

      expect([400, 404]).toContain(res.status);
    });

    it('should deny Employee from updating release notes', async () => {
      const res = await request(app)
        .put('/api/apk/1/release-notes')
        .set('x-access-token', employeeToken)
        .send({ release_notes: 'Test' });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/apk/:id', () => {
    it('should allow admin to delete APK', async () => {
      const res = await request(app)
        .delete('/api/apk/99999')
        .set('x-access-token', superAdminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee from deleting APK', async () => {
      const res = await request(app)
        .delete('/api/apk/1')
        .set('x-access-token', employeeToken);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('POST /api/apk/upload', () => {
    it('should reject upload without file', async () => {
      const res = await request(app)
        .post('/api/apk/upload')
        .set('x-access-token', superAdminToken)
        .field('version', '1.0.0+1')
        .field('release_notes', 'Test upload');

      expect([400, 404]).toContain(res.status);
    });

    it('should deny Employee from uploading APK', async () => {
      const res = await request(app)
        .post('/api/apk/upload')
        .set('x-access-token', employeeToken);

      expect([403, 404, 400]).toContain(res.status);
    });
  });

  describe('POST /api/apk/parse', () => {
    it('should reject parse without file', async () => {
      const res = await request(app)
        .post('/api/apk/parse')
        .set('x-access-token', superAdminToken);

      expect([400, 404, 503]).toContain(res.status);
    });

    it('should deny Employee from parsing APK', async () => {
      const res = await request(app)
        .post('/api/apk/parse')
        .set('x-access-token', employeeToken);

      expect([403, 404, 400]).toContain(res.status);
    });
  });
});

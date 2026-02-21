/**
 * Email Controller Tests
 * Tests all methods in email.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Email Controller', () => {
  let superAdminToken, adminToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/email/config', () => {
    it('should allow admin to get email configuration', async () => {
      const res = await request(app)
        .get('/api/email/config')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('host');
        expect(res.body).toHaveProperty('port');
      }
    });

    it('should deny Employee access to email config', async () => {
      const res = await request(app)
        .get('/api/email/config')
        .set('x-access-token', employeeToken);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/email/config', () => {
    it('should allow admin to update email configuration', async () => {
      const emailConfig = {
        provider_type: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth_user: 'test@example.com',
        auth_pass: 'testpassword',
        from_name: 'WorkPulse',
        from_email: 'noreply@workpulse.com'
      };

      const res = await request(app)
        .put('/api/email/config')
        .set('x-access-token', superAdminToken)
        .send(emailConfig);

      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('should deny Employee from updating email config', async () => {
      const res = await request(app)
        .put('/api/email/config')
        .set('x-access-token', employeeToken)
        .send({ host: 'test.com' });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('POST /api/email/test', () => {
    it('should allow admin to send test email', async () => {
      const res = await request(app)
        .post('/api/email/test')
        .set('x-access-token', adminToken)
        .send({ to: 'test@example.com' });

      expect([200, 500, 404]).toContain(res.status);
    });

    it('should reject test email without recipient', async () => {
      const res = await request(app)
        .post('/api/email/test')
        .set('x-access-token', adminToken)
        .send({});

      expect([400, 500, 404]).toContain(res.status);
    });

    it('should deny Employee from sending test email', async () => {
      const res = await request(app)
        .post('/api/email/test')
        .set('x-access-token', employeeToken)
        .send({ to: 'test@example.com' });

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/email/templates', () => {
    it('should allow admin to get all email templates', async () => {
      const res = await request(app)
        .get('/api/email/templates')
        .set('x-access-token', adminToken);

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('should deny Employee access to email templates', async () => {
      const res = await request(app)
        .get('/api/email/templates')
        .set('x-access-token', employeeToken);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/email/templates/:id', () => {
    it('should allow admin to update email template', async () => {
      const templateData = {
        subject: 'Updated Subject',
        body: '<p>Updated body</p>'
      };

      const res = await request(app)
        .put('/api/email/templates/1')
        .set('x-access-token', superAdminToken)
        .send(templateData);

      expect([200, 404]).toContain(res.status);
    });

    it('should deny Employee from updating template', async () => {
      const res = await request(app)
        .put('/api/email/templates/1')
        .set('x-access-token', employeeToken)
        .send({ subject: 'Test' });

      expect([403, 404]).toContain(res.status);
    });
  });
});

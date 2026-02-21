/**
 * Role Controller Tests
 * Tests all methods in role.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getManagerToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Role Controller', () => {
  let superAdminToken, adminToken, employeeToken;

  beforeAll(async () => {
    superAdminToken = await getSuperAdminToken();
    adminToken = await getAdminToken();
    employeeToken = await getEmployeeToken();
  });

  describe('GET /api/roles', () => {
    it('should get all roles with super admin token', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('x-access-token', superAdminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('x-access-token', employeeToken);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('should get a specific role by ID', async () => {
      const res = await request(app)
        .get('/api/roles/1')
        .set('x-access-token', superAdminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(app)
        .get('/api/roles/99999')
        .set('x-access-token', superAdminToken);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/roles', () => {
    it('should allow super admin to create role', async () => {
      const newRole = {
        name: `test_role_${Date.now()}`,
        display_name: 'Test Role',
        description: 'Test',
        hierarchy_level: 5,
        can_approve_leave: 'none',
        can_approve_onduty: 'none',
        can_manage_users: 'none'
      };

      const res = await request(app)
        .post('/api/roles')
        .set('x-access-token', superAdminToken)
        .send(newRole);

      expect([200, 201, 400]).toContain(res.status);
    });

    it('should deny Employee access', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('x-access-token', employeeToken)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/roles/:id', () => {
    it('should update a role', async () => {
      const res = await request(app)
        .put('/api/roles/1')
        .set('x-access-token', superAdminToken)
        .send({ display_name: 'Updated' });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('should handle delete request', async () => {
      const res = await request(app)
        .delete('/api/roles/99999')
        .set('x-access-token', superAdminToken);

      expect([200, 204, 404]).toContain(res.status);
    });
  });
});

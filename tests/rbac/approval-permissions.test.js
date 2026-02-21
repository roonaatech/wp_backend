/**
 * Approval Permissions Tests
 *
 * Validates role-based access to approval endpoints.
 */

const request = require('supertest');
const app = require('../../server');
const { getSuperAdminToken, getAdminToken, getEmployeeToken, getManagerToken } = require('../helpers/auth-helper');

describe('Approval Permissions', () => {
    describe('GET /api/admin/approvals', () => {
        it('should allow Super Admin', async () => {
            const token = await getSuperAdminToken();
            const res = await request(app).get('/api/admin/approvals').set('x-access-token', token);
            expect([200, 404]).toContain(res.status);
        });

        it('should allow Manager', async () => {
            const token = await getManagerToken();
            const res = await request(app).get('/api/admin/approvals').set('x-access-token', token);
            expect([200, 404]).toContain(res.status);
        });

        it('should DENY Employee', async () => {
            const token = await getEmployeeToken();
            const res = await request(app).get('/api/admin/approvals').set('x-access-token', token);
            expect(res.status).toBe(403);
        });
    });
});

/**
 * Dashboard Permissions Tests
 *
 * Validates role-based access to dashboard endpoints.
 */

const request = require('supertest');
const app = require('../../server');
const { getSuperAdminToken, getAdminToken, getEmployeeToken, getManagerToken } = require('../helpers/auth-helper');

describe('Dashboard Permissions', () => {
    describe('GET /api/admin/dashboard/stats', () => {
        it('should allow Super Admin', async () => {
            const token = await getSuperAdminToken();
            const res = await request(app).get('/api/admin/dashboard/stats').set('x-access-token', token);
            expect([200, 404]).toContain(res.status);
        });

        it('should DENY Employee', async () => {
            const token = await getEmployeeToken();
            const res = await request(app).get('/api/admin/dashboard/stats').set('x-access-token', token);
            expect(res.status).toBe(403);
        });
    });
});

/**
 * Dashboard Permissions Tests
 *
 * Validates role-based access to dashboard endpoints.
 */

const request = require('supertest');
const app = require('../../server');
const { getSuperAdminToken, getAdminToken, getEmployeeToken, getManagerToken, getHRToken } = require('../helpers/auth-helper');

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

    describe('GET /api/admin/dashboard/birthdays', () => {
        it('should allow Super Admin', async () => {
            const token = await getSuperAdminToken();
            const res = await request(app).get('/api/admin/dashboard/birthdays').set('x-access-token', token);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.birthdays)).toBe(true);
        });

        it('should allow Admin', async () => {
            const token = await getAdminToken();
            const res = await request(app).get('/api/admin/dashboard/birthdays').set('x-access-token', token);
            expect(res.status).toBe(200);
        });

        it('should allow Human Resource (has can_view_birthdays)', async () => {
            const token = await getHRToken();
            const res = await request(app).get('/api/admin/dashboard/birthdays').set('x-access-token', token);
            expect(res.status).toBe(200);
        });

        it('should DENY Manager (lacks can_view_birthdays)', async () => {
            const token = await getManagerToken();
            const res = await request(app).get('/api/admin/dashboard/birthdays').set('x-access-token', token);
            expect(res.status).toBe(403);
        });

        it('should DENY Employee', async () => {
            const token = await getEmployeeToken();
            const res = await request(app).get('/api/admin/dashboard/birthdays').set('x-access-token', token);
            expect(res.status).toBe(403);
        });

        it('should DENY requests without a token', async () => {
            const res = await request(app).get('/api/admin/dashboard/birthdays');
            expect(res.status).toBe(403);
        });
    });

    // Only the deny paths are exercised here: a successful POST would send real
    // birthday emails to real staff through the configured SMTP account.
    describe('POST /api/admin/dashboard/birthdays/send-wishes', () => {
        it('should DENY Manager (lacks can_view_birthdays)', async () => {
            const token = await getManagerToken();
            const res = await request(app)
                .post('/api/admin/dashboard/birthdays/send-wishes')
                .set('x-access-token', token)
                .send({ staff_ids: [] });
            expect(res.status).toBe(403);
        });

        it('should DENY Employee', async () => {
            const token = await getEmployeeToken();
            const res = await request(app)
                .post('/api/admin/dashboard/birthdays/send-wishes')
                .set('x-access-token', token)
                .send({ staff_ids: [] });
            expect(res.status).toBe(403);
        });

        it('should DENY requests without a token', async () => {
            const res = await request(app)
                .post('/api/admin/dashboard/birthdays/send-wishes')
                .send({ staff_ids: [] });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/admin/dashboard/anniversaries', () => {
        it('should allow Super Admin', async () => {
            const token = await getSuperAdminToken();
            const res = await request(app).get('/api/admin/dashboard/anniversaries').set('x-access-token', token);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.anniversaries)).toBe(true);
        });

        it('should allow Admin', async () => {
            const token = await getAdminToken();
            const res = await request(app).get('/api/admin/dashboard/anniversaries').set('x-access-token', token);
            expect(res.status).toBe(200);
        });

        it('should allow Human Resource (has can_view_anniversaries)', async () => {
            const token = await getHRToken();
            const res = await request(app).get('/api/admin/dashboard/anniversaries').set('x-access-token', token);
            expect(res.status).toBe(200);
        });

        it('should DENY Manager (lacks can_view_anniversaries)', async () => {
            const token = await getManagerToken();
            const res = await request(app).get('/api/admin/dashboard/anniversaries').set('x-access-token', token);
            expect(res.status).toBe(403);
        });

        it('should DENY Employee', async () => {
            const token = await getEmployeeToken();
            const res = await request(app).get('/api/admin/dashboard/anniversaries').set('x-access-token', token);
            expect(res.status).toBe(403);
        });

        it('should DENY requests without a token', async () => {
            const res = await request(app).get('/api/admin/dashboard/anniversaries');
            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/admin/dashboard/anniversaries/send-wishes', () => {
        it('should DENY Manager (lacks can_view_anniversaries)', async () => {
            const token = await getManagerToken();
            const res = await request(app)
                .post('/api/admin/dashboard/anniversaries/send-wishes')
                .set('x-access-token', token)
                .send({ staff_ids: [] });
            expect(res.status).toBe(403);
        });

        it('should DENY Employee', async () => {
            const token = await getEmployeeToken();
            const res = await request(app)
                .post('/api/admin/dashboard/anniversaries/send-wishes')
                .set('x-access-token', token)
                .send({ staff_ids: [] });
            expect(res.status).toBe(403);
        });

        it('should DENY requests without a token', async () => {
            const res = await request(app)
                .post('/api/admin/dashboard/anniversaries/send-wishes')
                .send({ staff_ids: [] });
            expect(res.status).toBe(403);
        });
    });
});

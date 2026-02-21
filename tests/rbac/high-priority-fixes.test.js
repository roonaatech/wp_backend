/**
 * RBAC High-Priority Fixes Tests (Issues #5-7 from RBAC_FIXES.md)
 *
 * These tests validate that MEDIUM/HIGH priority RBAC fixes are working:
 * - Issue #5: Middleware exports implicitly global variables (syntax-only fix, tested by loading correctly)
 * - Issue #6: GET /api/roles endpoint exposes full permission config to all users
 * - Issue #7: can_manage_roles allows self-privilege escalation
 */

const request = require('supertest');
const app = require('../../server');
const {
    getSuperAdminToken,
    getAdminToken,
    getEmployeeToken
} = require('../helpers/auth-helper');
const db = require('../../models');

describe('RBAC High-Priority Fixes - Issues #5-7', () => {

    // ============================================================
    // Issue #5: Implicit Global Variables in Auth Middleware
    // ============================================================
    describe('Issue #5: Auth Middleware exports', () => {
        it('should export all expected functions', () => {
            const authJwt = require('../../middleware/authJwt');

            expect(typeof authJwt.verifyToken).toBe('function');
            expect(typeof authJwt.isManagerOrAdmin).toBe('function');
            expect(typeof authJwt.isAdmin).toBe('function');
            expect(typeof authJwt.canAccessWebApp).toBe('function');
            expect(typeof authJwt.canManageLeaveTypes).toBe('function');
            expect(typeof authJwt.canViewActivities).toBe('function');
        });
    });

    // ============================================================
    // Issue #6: /api/roles GET Exposes Full Permission Config
    // ============================================================
    describe('Issue #6: /api/roles permission masking', () => {
        it('should return full role fields for user with can_manage_roles', async () => {
            const token = await getSuperAdminToken(); // Super Admin has can_manage_roles: true

            const res = await request(app)
                .get('/api/roles')
                .set('x-access-token', token);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBeTruthy();

            if (res.body.length > 0) {
                // Super Admin should see these fields
                expect(res.body[0]).toHaveProperty('can_manage_roles');
                expect(res.body[0]).toHaveProperty('can_access_webapp');
            }
        });

        it('should return REDUCED role fields for user without can_manage_roles', async () => {
            const token = await getEmployeeToken(); // Employee has can_manage_roles: false

            const res = await request(app)
                .get('/api/roles')
                .set('x-access-token', token);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBeTruthy();

            if (res.body.length > 0) {
                // Employee should NOT see sensitive fields
                expect(res.body[0]).toHaveProperty('id');
                expect(res.body[0]).toHaveProperty('name');
                expect(res.body[0]).not.toHaveProperty('can_manage_roles');
                expect(res.body[0]).not.toHaveProperty('can_access_webapp');
            }
        });
    });

    // ============================================================
    // Issue #7: can_manage_roles Self-Privilege Escalation
    // ============================================================
    describe('Issue #7: Role update hierarchy guards', () => {
        let testRole;

        beforeAll(async () => {
            // Create a test role
            const Role = db.roles;
            testRole = await Role.create({
                name: 'test_hierarchy_role',
                display_name: 'Test Hierarchy Role',
                hierarchy_level: 5, // Lower authority
                can_manage_roles: false
            });
        });

        afterAll(async () => {
            if (testRole) {
                await testRole.destroy();
            }
        });

        it('should block Admin (level 1) from modifying Super Admin (level 0)', async () => {
            const token = await getAdminToken();

            // Find Super Admin role id
            const Role = db.roles;
            const superAdminRole = await Role.findOne({ where: { hierarchy_level: 0 } });

            if (!superAdminRole) return; // Skip if no super admin

            const res = await request(app)
                .put(`/api/roles/${superAdminRole.id}`)
                .set('x-access-token', token)
                .send({
                    display_name: 'Hacked Super Admin'
                });

            // Admin should be blocked by hierarchy guard
            expect(res.status).toBe(403);
        });

        it('should allow Super Admin to modify any role', async () => {
            const token = await getSuperAdminToken();

            const res = await request(app)
                .put(`/api/roles/${testRole.id}`)
                .set('x-access-token', token)
                .send({
                    display_name: 'Updated by SuberAdmin'
                });

            expect(res.status).toBe(200);
        });
    });
});

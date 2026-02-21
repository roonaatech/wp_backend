/**
 * Auth Controller Tests
 * Tests authentication endpoints and methods
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');

describe('Auth Controller', () => {

  describe('POST /api/auth/signup', () => {
    it('should create a new user account', async () => {
      const newUser = {
        firstname: 'Test',
        lastname: 'User',
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        role: 4 // Employee
      };

      const res = await request(app)
        .post('/api/auth/signup')
        .send(newUser);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject signup with missing fields', async () => {
      const invalidUser = {
        firstname: 'Test'
        // Missing required fields
      };

      const res = await request(app)
        .post('/api/auth/signup')
        .send(invalidUser);

      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      const existingUser = {
        firstname: 'Existing',
        lastname: 'User',
        email: 'duplicate@test.com',
        password: 'password123',
        role: 4
      };

      // Create first user
      await request(app).post('/api/auth/signup').send(existingUser);

      // Try to create duplicate
      const res = await request(app)
        .post('/api/auth/signup')
        .send(existingUser);

      expect([400, 409]).toContain(res.status);
    });
  });

  describe('POST /api/auth/signin', () => {
    beforeAll(async () => {
      // Ensure test user exists
      const testUser = {
        firstname: 'SignIn',
        lastname: 'Test',
        email: 'signin.test@example.com',
        password: 'password123',
        role: 4
      };

      await request(app).post('/api/auth/signup').send(testUser);
    });

    it('should authenticate user with valid credentials', async () => {
      const credentials = {
        email: 'signin.test@example.com',
        password: 'password123'
      };

      const res = await request(app)
        .post('/api/auth/signin')
        .send(credentials);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(credentials.email);
    });

    it('should reject invalid password', async () => {
      const credentials = {
        email: 'signin.test@example.com',
        password: 'wrongpassword'
      };

      const res = await request(app)
        .post('/api/auth/signin')
        .send(credentials);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject non-existent user', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const res = await request(app)
        .post('/api/auth/signin')
        .send(credentials);

      expect(res.status).toBe(404);
    });

    it('should reject signin with missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com' }); // Missing password

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should refresh token with valid token', async () => {
      // First sign in to get a token
      const signInRes = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'signin.test@example.com',
          password: 'password123'
        });

      const token = signInRes.body.accessToken;

      // Refresh the token
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('x-access-token', token);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject refresh without token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/auth/signout', () => {
    it('should sign out successfully', async () => {
      const res = await request(app)
        .post('/api/auth/signout');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});

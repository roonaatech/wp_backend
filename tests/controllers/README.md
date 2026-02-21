# Controller Tests

This directory contains unit and integration tests for all controller methods.

## Test Structure

Each controller should have a corresponding test file:

```
controllers/admin.controller.js    → tests/controllers/admin.controller.test.js
controllers/leave.controller.js    → tests/controllers/leave.controller.test.js
controllers/auth.controller.js     → tests/controllers/auth.controller.test.js
... etc
```

## Test Types

### Unit Tests
Test individual controller methods in isolation:
- Mock database calls
- Test business logic
- Test error handling
- Test data validation

### Integration Tests
Test controller methods with real database:
- Test database interactions
- Test complete request/response flow
- Test with real data

## Example Test Template

```javascript
/**
 * Admin Controller Tests
 * Tests all methods in admin.controller.js
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../models');
const { getSuperAdminToken, getAdminToken, getEmployeeToken } = require('../helpers/auth-helper');

describe('Admin Controller', () => {

  describe('GET /api/admin/users', () => {
    it('should fetch all users for super admin', async () => {
      const token = await getSuperAdminToken();
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-access-token', token);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should return 403 for employee without permission', async () => {
      const token = await getEmployeeToken();
      const res = await request(app)
        .get('/api/admin/users')
        .set('x-access-token', token);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a new user', async () => {
      const token = await getSuperAdminToken();
      const newUser = {
        firstname: 'Test',
        lastname: 'User',
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        role: 4
      };

      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', token)
        .send(newUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(newUser.email);
    });

    it('should validate required fields', async () => {
      const token = await getSuperAdminToken();
      const res = await request(app)
        .post('/api/admin/users')
        .set('x-access-token', token)
        .send({ firstname: 'Test' }); // Missing required fields

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('should update user details', async () => {
      const token = await getSuperAdminToken();
      const userId = 1;
      const updates = { firstname: 'Updated' };

      const res = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('x-access-token', token)
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body.user.firstname).toBe('Updated');
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete a user', async () => {
      const token = await getSuperAdminToken();
      const userId = 999; // Test user ID

      const res = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set('x-access-token', token);

      expect([200, 404]).toContain(res.status);
    });
  });
});
```

## Testing Best Practices

1. **Test each HTTP method** (GET, POST, PUT, DELETE)
2. **Test success scenarios** (happy path)
3. **Test error scenarios** (validation, permissions, not found)
4. **Test edge cases** (empty data, invalid IDs, etc.)
5. **Use descriptive test names** (should do X when Y)
6. **Clean up test data** (in afterEach/afterAll hooks if needed)
7. **Mock external dependencies** (email services, file uploads, etc.)

## Coverage Goals

Aim for high coverage of controller methods:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Running Controller Tests

```bash
# Run all controller tests
npm run test:coverage

# Run specific controller test
NODE_ENV=test jest tests/controllers/admin.controller.test.js

# Run with watch mode
npm run test:watch
```

## Controllers to Test

- [ ] admin.controller.js
- [ ] auth.controller.js
- [ ] leave.controller.js
- [ ] leavetype.controller.js
- [ ] onduty.controller.js
- [ ] role.controller.js
- [ ] timeoff.controller.js
- [ ] userleavetype.controller.js
- [ ] activity.controller.js
- [ ] apk.controller.js
- [ ] attendance.controller.js
- [ ] dashboard.controller.js
- [ ] email.controller.js
- [ ] history.controller.js
- [ ] setting.controller.js
- [ ] attendance_status.controller.js

# Swagger API Documentation

This backend uses **Swagger/OpenAPI 3.0** for comprehensive API documentation.

## Accessing Swagger UI

Once the backend is running, visit:

```
http://localhost:3000/api-docs
```

You'll see an interactive Swagger UI where you can:
- Browse all API endpoints
- View request/response schemas
- Test API calls directly from the browser
- Copy curl commands
- View authentication requirements

## Features

### Interactive Testing
- Click on any endpoint to expand it
- View required parameters and request body format
- Execute API calls with real data
- See responses in real-time

### Authentication
- Click **"Authorize"** button at the top
- Enter your JWT token in the format: `Bearer <your_token_here>`
- All subsequent requests will include this token automatically

### Endpoints Documented

#### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Login user

#### Leave Requests
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave/my-history` - Get user's leave history
- `PUT /api/leave/:id` - Update leave details

#### Leave Management (Admin/Manager)
- `GET /api/leave/requests` - Get all manageable requests with pagination
- `PUT /api/leave/:id/status` - Approve/Reject/Revert leave

#### On-Duty
- `POST /api/onduty/start` - Start on-duty session
- `POST /api/onduty/end` - End on-duty session
- `GET /api/onduty/active` - Get active on-duty session

#### On-Duty Management (Admin/Manager)
- `PUT /api/onduty/:id/status` - Approve/Reject/Revert on-duty

## API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "message": "Error description",
  "status": 400
}
```

## Authentication

The API uses JWT (JSON Web Token) for authentication:

1. Call `/api/auth/signin` to get a token
2. Copy the `token` from the response
3. Click **Authorize** in Swagger
4. Paste the token (no need for "Bearer" prefix, Swagger adds it automatically)
5. All subsequent requests will include the token

## Key Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

### Filtering
- `status` - Filter by request status (Pending, Approved, Rejected)

### Sorting
- Results are sorted by creation date (newest first)

## Rate Limiting

Currently, there's no rate limiting implemented. For production:
- Implement rate limiting using `express-rate-limit`
- Set reasonable limits (e.g., 100 requests per 15 minutes)

## CORS Configuration

The API is configured to accept requests from:
- Frontend applications on any origin (currently using wildcard `*`)
- For production, specify exact origins

## Testing with cURL

Example login request:
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Example authenticated request:
```bash
curl -X GET http://localhost:3000/api/leave/my-history \
  -H "x-access-token: <your_jwt_token>"
```

## OpenAPI Specification

The OpenAPI/Swagger specification is automatically generated from JSDoc comments in route files.

To export the specification as JSON:
```bash
curl http://localhost:3000/api-docs/json
```

Or visit:
```
http://localhost:3000/swagger-ui/spec
```

## Updating Documentation

To add documentation for new endpoints:

1. Add JSDoc comments above the route definition
2. Use the following format:

```javascript
/**
 * @swagger
 * /api/path:
 *   get:
 *     tags:
 *       - Category
 *     summary: Brief description
 *     description: Detailed description
 *     parameters:
 *       - name: paramName
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success response
 *       401:
 *         description: Unauthorized
 */
```

3. Swagger will automatically pick up the changes

## Resources

- [Swagger/OpenAPI Documentation](https://swagger.io/tools/swagger-ui/)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger JSDoc](https://github.com/Surnet/swagger-jsdoc)

## Troubleshooting

### Swagger UI not loading
- Check that `swagger-ui-express` and `swagger-jsdoc` are installed
- Verify the swagger.js configuration file exists
- Check browser console for errors

### Endpoints not appearing
- Ensure JSDoc comments are formatted correctly
- Check that route files are listed in `swagger.js` api array
- Restart the server after adding new documentation

### Authentication not working
- Ensure token is copied correctly from login response
- Token should be valid JWT format
- Check that endpoints have `security: [{bearerAuth: []}]` in documentation

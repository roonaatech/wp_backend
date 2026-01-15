const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Attendance Management System API',
      version: '1.0.0',
      description: 'Complete API documentation for the Attendance Management System',
      contact: {
        name: 'Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server'
      },
      {
        url: 'http://your_server_ip:3000',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-access-token',
          description: 'JWT Token for authentication. Pass token in header as: x-access-token: <token>'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string'
            },
            status: {
              type: 'integer'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            staffid: {
              type: 'integer'
            },
            firstname: {
              type: 'string'
            },
            lastname: {
              type: 'string'
            },
            email: {
              type: 'string'
            },
            phonenumber: {
              type: 'string'
            },
            role: {
              type: 'string'
            }
          }
        },
        LeaveRequest: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            staff_id: {
              type: 'integer'
            },
            leave_type: {
              type: 'string'
            },
            start_date: {
              type: 'string',
              format: 'date'
            },
            end_date: {
              type: 'string',
              format: 'date'
            },
            reason: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['Pending', 'Approved', 'Rejected']
            },
            rejection_reason: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        OnDutyLog: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            staff_id: {
              type: 'integer'
            },
            client_name: {
              type: 'string'
            },
            location: {
              type: 'string'
            },
            purpose: {
              type: 'string'
            },
            start_time: {
              type: 'string',
              format: 'date-time'
            },
            end_time: {
              type: 'string',
              format: 'date-time'
            },
            status: {
              type: 'string',
              enum: ['Pending', 'Approved', 'Rejected']
            },
            rejection_reason: {
              type: 'string'
            }
          }
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer'
            },
            pageSize: {
              type: 'integer'
            },
            totalCount: {
              type: 'integer'
            },
            totalPages: {
              type: 'integer'
            },
            leaveCount: {
              type: 'integer'
            },
            onDutyCount: {
              type: 'integer'
            },
            hasNextPage: {
              type: 'boolean'
            },
            hasPrevPage: {
              type: 'boolean'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ]
  },
  apis: [
    './routes/auth.routes.js',
    './routes/leave.routes.js',
    './routes/onduty.routes.js',
    './routes/admin.routes.js',
    './routes/leavetype.routes.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;

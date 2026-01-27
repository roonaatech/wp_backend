const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WorkPulse API',
      version: '1.0.0',
      description: 'Complete API documentation for the WorkPulse API',
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
            start_lat: {
              type: 'string',
              description: 'Starting latitude coordinate'
            },
            start_long: {
              type: 'string',
              description: 'Starting longitude coordinate'
            },
            end_lat: {
              type: 'string',
              description: 'Ending latitude coordinate'
            },
            end_long: {
              type: 'string',
              description: 'Ending longitude coordinate'
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
        Role: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            name: {
              type: 'string'
            },
            display_name: {
              type: 'string'
            },
            description: {
              type: 'string'
            },
            hierarchy_level: {
              type: 'integer',
              description: '0 = highest authority, higher numbers = lower authority'
            },
            can_approve_leave: {
              type: 'boolean'
            },
            can_approve_onduty: {
              type: 'boolean'
            },
            can_manage_users: {
              type: 'boolean'
            },
            can_manage_leave_types: {
              type: 'boolean'
            },
            can_view_reports: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        UserLeaveType: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            staff_id: {
              type: 'integer'
            },
            leave_type_id: {
              type: 'integer'
            },
            allocated_days: {
              type: 'number'
            },
            used_days: {
              type: 'number'
            },
            remaining_days: {
              type: 'number'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
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
    './routes/leavetype.routes.js',
    './routes/activity.routes.js',
    './routes/debug.routes.js',
    './routes/role.routes.js',
    './routes/userleavetype.routes.js',
    './routes/email.routes.js',
    './routes/apk.routes.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;

/**
 * Endpoint Catalog for RBAC Validation Testing
 *
 * Complete catalog of all 78 API endpoints with their middleware and expected accessible roles.
 * Extracted from 13 route files in wp_backend/routes/*.routes.js
 *
 * Format:
 * - method: HTTP method (GET, POST, PUT, DELETE)
 * - path: Full API path
 * - middleware: Array of authJwt middleware functions
 * - expectedRoles: Array of role display names that should have access
 * - description: Brief description of endpoint functionality
 */

const ENDPOINTS = [
  // ========================================
  // ADMIN ROUTES (13 endpoints)
  // ========================================
  {
    method: 'GET',
    path: '/api/admin/dashboard/stats',
    middleware: ['verifyToken', 'canAccessWebApp'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get dashboard statistics'
  },
  {
    method: 'GET',
    path: '/api/admin/dashboard/daily-trend',
    middleware: ['verifyToken', 'canAccessWebApp'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get daily approval trend data'
  },
  {
    method: 'GET',
    path: '/api/admin/incomplete-profiles',
    middleware: ['verifyToken', 'canManageUsers'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get incomplete user profiles'
  },
  {
    method: 'GET',
    path: '/api/admin/calendar',
    middleware: ['verifyToken', 'canManageSchedule'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get calendar events for leave and on-duty'
  },
  {
    method: 'GET',
    path: '/api/admin/calendar/debug',
    middleware: ['verifyToken', 'canManageSchedule'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Debug calendar data'
  },
  {
    method: 'GET',
    path: '/api/admin/users',
    middleware: ['verifyToken', 'canViewUsers'],
    expectedRoles: ['Super Admin','Admin','Manager','Supervisor'],
    description: 'Get all users'
  },
  {
    method: 'GET',
    path: '/api/admin/managers-admins',
    middleware: ['verifyToken', 'canViewUsers'],
    expectedRoles: ['Super Admin','Admin','Manager','Supervisor'],
    description: 'Get all managers and admins'
  },
  {
    method: 'POST',
    path: '/api/admin/users',
    middleware: ['verifyToken', 'canManageUsers'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Create a new user'
  },
  {
    method: 'PUT',
    path: '/api/admin/users/1',
    middleware: ['verifyToken', 'canManageUsers'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Update user details'
  },
  {
    method: 'POST',
    path: '/api/admin/users/1/reset-password',
    middleware: ['verifyToken', 'canManageUsers'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Reset user password (Admin only)'
  },
  {
    method: 'GET',
    path: '/api/admin/approvals',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get pending approvals'
  },
  {
    method: 'PUT',
    path: '/api/admin/approvals/1',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Approve or reject an attendance request'
  },
  {
    method: 'GET',
    path: '/api/admin/reports',
    middleware: ['verifyToken', 'canViewReports'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get attendance reports'
  },

  // ========================================
  // AUTH ROUTES (4 endpoints)
  // ========================================
  {
    method: 'POST',
    path: '/api/auth/signup',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Register a new user (No Auth Required)'
  },
  {
    method: 'POST',
    path: '/api/auth/signin',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Login user (No Auth Required)'
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Logout user'
  },
  {
    method: 'POST',
    path: '/api/auth/change-password',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Change user password'
  },

  // ========================================
  // DEBUG ROUTES (1 endpoint - Dev only)
  // ========================================
  {
    method: 'GET',
    path: '/api/debug/approvals-count',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Get counts for debugging (production-gated)'
  },

  // ========================================
  // LEAVE ROUTES (10 endpoints)
  // ========================================
  {
    method: 'POST',
    path: '/api/leave/apply',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Apply for leave'
  },
  {
    method: 'PUT',
    path: '/api/leave/1',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Update leave request details'
  },
  {
    method: 'GET',
    path: '/api/leave/my-history',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: "Get user's leave history"
  },
  {
    method: 'GET',
    path: '/api/leave/pending',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get pending leave requests'
  },
  {
    method: 'GET',
    path: '/api/leave/requests',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get manageable leave requests'
  },
  {
    method: 'PUT',
    path: '/api/leave/1/status',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Update leave request status'
  },
  {
    method: 'GET',
    path: '/api/admin/stats',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get overall admin statistics'
  },
  {
    method: 'GET',
    path: '/api/leave/my-stats',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: "Get user's leave statistics"
  },
  {
    method: 'DELETE',
    path: '/api/leave/1',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Delete a leave request'
  },
  {
    method: 'GET',
    path: '/api/leave/user-balance/1',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get leave balance for a specific user'
  },
  {
    method: 'GET',
    path: '/api/leave/my-balance',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: "Get current user's leave balance"
  },

  // ========================================
  // ON-DUTY ROUTES (8 endpoints)
  // ========================================
  {
    method: 'POST',
    path: '/api/onduty/start',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Start on-duty logging'
  },
  {
    method: 'POST',
    path: '/api/onduty/end',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'End on-duty logging'
  },
  {
    method: 'GET',
    path: '/api/onduty/active-all',
    middleware: ['verifyToken', 'canManageActiveOnDuty'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get all active on-duty sessions'
  },
  {
    method: 'GET',
    path: '/api/onduty/active',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get active on-duty session'
  },
  {
    method: 'GET',
    path: '/api/onduty',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get on-duty logs by status'
  },
  {
    method: 'PUT',
    path: '/api/onduty/1/status',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Update on-duty status (Approve/Reject)'
  },
  {
    method: 'PUT',
    path: '/api/onduty/1',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Update on-duty session details'
  },
  {
    method: 'DELETE',
    path: '/api/onduty/1',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Delete an on-duty log'
  },

  // ========================================
  // ROLE ROUTES (7 endpoints)
  // ========================================
  {
    method: 'GET',
    path: '/api/roles',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get all roles (filtered by can_manage_roles permission)'
  },
  {
    method: 'GET',
    path: '/api/roles/statistics',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Get role statistics'
  },
  {
    method: 'GET',
    path: '/api/roles/1',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Get single role by ID'
  },
  {
    method: 'POST',
    path: '/api/roles',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Create new role'
  },
  {
    method: 'PUT',
    path: '/api/roles/1',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Update role'
  },
  {
    method: 'DELETE',
    path: '/api/roles/1',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Delete role'
  },
  {
    method: 'PUT',
    path: '/api/roles/hierarchy/update',
    middleware: ['verifyToken', 'canManageRoles'],
    expectedRoles: ['Super Admin'],
    description: 'Update role hierarchy'
  },

  // ========================================
  // ACTIVITY ROUTES (5 endpoints)
  // ========================================
  {
    method: 'POST',
    path: '/api/activities/mobile-log',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Log activity from mobile app (No Auth Required)'
  },
  {
    method: 'GET',
    path: '/api/activities/summary',
    middleware: ['verifyToken', 'canViewActivities'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager'],
    description: 'Get activity summary'
  },
  {
    method: 'GET',
    path: '/api/activities/export/csv',
    middleware: ['verifyToken', 'canViewActivities'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager'],
    description: 'Export activities as CSV'
  },
  {
    method: 'GET',
    path: '/api/activities/user/1',
    middleware: ['verifyToken', 'canViewActivities'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager'],
    description: 'Get user activity history'
  },
  {
    method: 'GET',
    path: '/api/activities',
    middleware: ['verifyToken', 'canViewActivities'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager'],
    description: 'Get all activities'
  },

  // ========================================
  // LEAVE TYPE ROUTES (6 endpoints)
  // ========================================
  {
    method: 'GET',
    path: '/api/leavetypes',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get all active leave types'
  },
  {
    method: 'GET',
    path: '/api/leavetypes/user/filtered',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get leave types filtered by user gender'
  },
  {
    method: 'GET',
    path: '/api/leavetypes/admin/all',
    middleware: ['verifyToken', 'canManageUsers'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Get all leave types (Admin)'
  },
  {
    method: 'POST',
    path: '/api/leavetypes',
    middleware: ['verifyToken', 'canManageLeaveTypes'],
    expectedRoles: ['Super Admin'],
    description: 'Create a new leave type'
  },
  {
    method: 'PUT',
    path: '/api/leavetypes/1',
    middleware: ['verifyToken', 'canManageLeaveTypes'],
    expectedRoles: ['Super Admin'],
    description: 'Update a leave type'
  },
  {
    method: 'DELETE',
    path: '/api/leavetypes/1',
    middleware: ['verifyToken', 'canManageLeaveTypes'],
    expectedRoles: ['Super Admin'],
    description: 'Delete a leave type'
  },

  // ========================================
  // USER LEAVE TYPE ROUTES (2 endpoints)
  // ========================================
  {
    method: 'GET',
    path: '/api/user/1/leave-types',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get user leave types'
  },
  {
    method: 'PUT',
    path: '/api/user/1/leave-types',
    middleware: ['verifyToken', 'canManageUsers'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Update user leave types'
  },

  // ========================================
  // SETTING ROUTES (3 endpoints)
  // ========================================
  {
    method: 'GET',
    path: '/api/settings/public',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get public settings (No Auth Required)'
  },
  {
    method: 'GET',
    path: '/api/settings',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get system settings'
  },
  {
    method: 'POST',
    path: '/api/settings',
    middleware: ['verifyToken', 'canManageSystemSettings'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Update or create a system setting'
  },

  // ========================================
  // EMAIL ROUTES (5 endpoints)
  // ========================================
  {
    method: 'GET',
    path: '/api/email/config',
    middleware: ['verifyToken', 'canManageEmailSettings'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Get email configuration'
  },
  {
    method: 'POST',
    path: '/api/email/config',
    middleware: ['verifyToken', 'canManageEmailSettings'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Update or create email configuration'
  },
  {
    method: 'POST',
    path: '/api/email/test',
    middleware: ['verifyToken', 'canManageEmailSettings'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Send a test email'
  },
  {
    method: 'GET',
    path: '/api/email/templates',
    middleware: ['verifyToken', 'canManageEmailSettings'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Get all email templates'
  },
  {
    method: 'PUT',
    path: '/api/email/templates/1',
    middleware: ['verifyToken', 'canManageEmailSettings'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Update an email template'
  },

  // ========================================
  // TIME-OFF ROUTES (5 endpoints)
  // ========================================
  {
    method: 'POST',
    path: '/api/timeoff/apply',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Apply for time-off'
  },
  {
    method: 'PUT',
    path: '/api/timeoff/1',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Update time-off request details'
  },
  {
    method: 'PUT',
    path: '/api/timeoff/1/status',
    middleware: ['verifyToken', 'isManagerOrAdmin'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor'],
    description: 'Update status (Approve/Reject)'
  },
  {
    method: 'DELETE',
    path: '/api/timeoff/1',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Delete a time-off request'
  },
  {
    method: 'GET',
    path: '/api/timeoff/my-history',
    middleware: ['verifyToken'],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get my time-off request history'
  },

  // ========================================
  // APK ROUTES (9 endpoints)
  // ========================================
  {
    method: 'POST',
    path: '/api/apk/parse',
    middleware: ['verifyToken', 'isAdmin'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Parse APK file to extract version info'
  },
  {
    method: 'POST',
    path: '/api/apk/upload',
    middleware: ['verifyToken', 'isAdmin'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Upload a new APK version'
  },
  {
    method: 'GET',
    path: '/api/apk/list',
    middleware: ['verifyToken', 'isAdmin'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Get all APK versions'
  },
  {
    method: 'GET',
    path: '/api/apk/latest',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Get latest visible APK (No Auth Required)'
  },
  {
    method: 'POST',
    path: '/api/apk/check-version',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Check if app update is required (No Auth Required)'
  },
  {
    method: 'GET',
    path: '/api/apk/download/1',
    middleware: [],
    expectedRoles: ['Super Admin','Admin','Human Resource','Manager','Supervisor','Employee'],
    description: 'Download an APK file (No Auth Required)'
  },
  {
    method: 'DELETE',
    path: '/api/apk/1',
    middleware: ['verifyToken', 'isAdmin'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Delete an APK version'
  },
  {
    method: 'PUT',
    path: '/api/apk/1/visibility',
    middleware: ['verifyToken', 'isAdmin'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Update APK visibility'
  },
  {
    method: 'PUT',
    path: '/api/apk/1/release-notes',
    middleware: ['verifyToken', 'isAdmin'],
    expectedRoles: ['Super Admin','Admin'],
    description: 'Update APK release notes'
  }
];

/**
 * ENDPOINT SUMMARY
 * ================
 * Total Endpoints: 78
 *
 * Breakdown by Route File:
 * - admin.routes.js: 13 endpoints
 * - auth.routes.js: 4 endpoints
 * - debug.routes.js: 1 endpoint (dev only)
 * - leave.routes.js: 11 endpoints
 * - onduty.routes.js: 8 endpoints
 * - role.routes.js: 7 endpoints
 * - activity.routes.js: 5 endpoints
 * - leavetype.routes.js: 6 endpoints
 * - userleavetype.routes.js: 2 endpoints
 * - setting.routes.js: 3 endpoints
 * - email.routes.js: 5 endpoints
 * - timeoff.routes.js: 5 endpoints
 * - apk.routes.js: 9 endpoints
 *
 * Total Test Combinations: 5 roles × 78 endpoints = 390 tests
 */

module.exports = {
  ENDPOINTS,
  getAllEndpoints: () => ENDPOINTS,
  getEndpointsByMiddleware: (middleware) => ENDPOINTS.filter(e => e.middleware.includes(middleware)),
  getEndpointsByMethod: (method) => ENDPOINTS.filter(e => e.method === method),
  getTotalCount: () => ENDPOINTS.length
};

/**
 * Role Catalog for RBAC Validation Testing
 *
 * Defines all 6 roles with their hierarchy levels and permissions.
 * Generated from actual database permissions.
 *
 * Source: Direct query from roles table
 */

const ROLES = [
  {
    id: 1,
    name: "super_admin",
    display_name: "Super Admin",
    description: "Full system access with all permissions",
    hierarchy_level: 0,
    permissions: {
      can_approve_leave: "all",
      can_approve_onduty: "all",
      can_approve_timeoff: "all",
      can_manage_users: "all",
      can_view_users: "all",
      can_view_reports: "all",
      can_access_webapp: true,
      can_manage_roles: true,
      can_manage_active_onduty: "all",
      can_manage_schedule: "all",
      can_view_activities: "all",
      can_manage_leave_types: true,
      can_manage_email_settings: true,
      can_manage_system_settings: "all"
    },
    active: true
  },
  {
    id: 3,
    name: "admin",
    display_name: "Admin",
    description: "Administrative access with most permissions",
    hierarchy_level: 1,
    permissions: {
      can_approve_leave: "all",
      can_approve_onduty: "all",
      can_approve_timeoff: "all",
      can_manage_users: "all",
      can_view_users: "all",
      can_view_reports: "all",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_active_onduty: "all",
      can_manage_schedule: "all",
      can_view_activities: "all",
      can_manage_leave_types: false,
      can_manage_email_settings: true,
      can_manage_system_settings: "all"
    },
    active: true
  },
  {
    id: 5,
    name: "human_resource",
    display_name: "Human Resource",
    description: "HR with subordinate management and full reporting",
    hierarchy_level: 2,
    permissions: {
      can_approve_leave: "subordinates",
      can_approve_onduty: "subordinates",
      can_approve_timeoff: "none",
      can_manage_users: "subordinates",
      can_view_users: "none",
      can_view_reports: "all",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_active_onduty: "subordinates",
      can_manage_schedule: "subordinates",
      can_view_activities: "subordinates",
      can_manage_leave_types: false,
      can_manage_email_settings: false,
      can_manage_system_settings: "none"
    },
    active: true
  },
  {
    id: 2,
    name: "manager",
    display_name: "Manager",
    description: "Team manager with subordinate oversight",
    hierarchy_level: 3,
    permissions: {
      can_approve_leave: "subordinates",
      can_approve_onduty: "subordinates",
      can_approve_timeoff: "none",
      can_manage_users: "subordinates",
      can_view_users: "all",
      can_view_reports: "subordinates",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_active_onduty: "subordinates",
      can_manage_schedule: "subordinates",
      can_view_activities: "all",
      can_manage_leave_types: false,
      can_manage_email_settings: false,
      can_manage_system_settings: "none"
    },
    active: true
  },
  {
    id: 6,
    name: "supervisor",
    display_name: "Supervisor",
    description: "Frontline supervisor with team management",
    hierarchy_level: 4,
    permissions: {
      can_approve_leave: "subordinates",
      can_approve_onduty: "subordinates",
      can_approve_timeoff: "none",
      can_manage_users: "subordinates",
      can_view_users: "all",
      can_view_reports: "subordinates",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_active_onduty: "subordinates",
      can_manage_schedule: "subordinates",
      can_view_activities: "none",
      can_manage_leave_types: false,
      can_manage_email_settings: false,
      can_manage_system_settings: "none"
    },
    active: true
  },
  {
    id: 4,
    name: "employee",
    display_name: "Employee",
    description: "Standard employee with basic access",
    hierarchy_level: 5,
    permissions: {
      can_approve_leave: "none",
      can_approve_onduty: "none",
      can_approve_timeoff: "none",
      can_manage_users: "none",
      can_view_users: "none",
      can_view_reports: "none",
      can_access_webapp: false,
      can_manage_roles: false,
      can_manage_active_onduty: "none",
      can_manage_schedule: "none",
      can_view_activities: "none",
      can_manage_leave_types: false,
      can_manage_email_settings: false,
      can_manage_system_settings: "none"
    },
    active: true
  }
];

/**
 * ROLE SUMMARY
 * =============
 * Total Roles: 6
 *
 * Hierarchy:
 * 0 - Super Admin (Full access)
 * 1 - Admin (Almost full access, except roles & leave types)
 * 2 - Human Resource (Subordinates + full reports)
 * 3 - Manager (Subordinates + view all users/activities)
 * 4 - Supervisor (Subordinates + view all users)
 * 5 - Employee (Basic authenticated access only)
 */

module.exports = {
  ROLES,
  getRoleById: (id) => ROLES.find(r => r.id === id),
  getRoleByName: (name) => ROLES.find(r => r.name === name),
  getAllRoles: () => ROLES
};

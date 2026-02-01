const db = require("../models");
const Role = db.roles;

async function seedRoles() {
  const roles = [
    {
      id: 1,
      name: "super_admin",
      display_name: "Super Admin",
      description: "Full system access with all permissions",
      hierarchy_level: 0,
      can_approve_leave: "all",
      can_approve_onduty: "all",
      can_manage_users: "all",
      can_manage_leave_types: true,
      can_view_reports: "all",
      can_access_webapp: true,
      can_manage_roles: true,
      can_manage_email_settings: true,
      can_manage_active_onduty: "all",
      can_manage_schedule: "all",
      can_view_activities: "all",
      active: true
    },
    {
      id: 3,
      name: "admin",
      display_name: "Admin",
      description: "Team lead with limited approval permissions",
      hierarchy_level: 1,
      can_approve_leave: "all",
      can_approve_onduty: "all",
      can_manage_users: "all",
      can_manage_leave_types: false,
      can_view_reports: "all",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_email_settings: false,
      can_manage_active_onduty: "subordinates",
      can_manage_schedule: "all",
      can_view_activities: "none",
      active: true
    },
    {
      id: 5,
      name: "human_resource",
      display_name: "Human Resource",
      description: "Manage users leave and on-duty and generate report",
      hierarchy_level: 2,
      can_approve_leave: "subordinates",
      can_approve_onduty: "subordinates",
      can_manage_users: "subordinates",
      can_manage_leave_types: false,
      can_view_reports: "all",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_email_settings: false,
      can_manage_active_onduty: "all",
      can_manage_schedule: "all",
      can_view_activities: "all",
      active: true
    },
    {
      id: 2,
      name: "manager",
      display_name: "Manager",
      description: "Can manage team members and approve requests",
      hierarchy_level: 3,
      can_approve_leave: "subordinates",
      can_approve_onduty: "subordinates",
      can_manage_users: "subordinates",
      can_manage_leave_types: false,
      can_view_reports: "subordinates",
      can_access_webapp: true,
      can_manage_roles: false,
      can_manage_email_settings: false,
      can_manage_active_onduty: "subordinates",
      can_manage_schedule: "subordinates",
      can_view_activities: "all",
      active: true
    },
    {
      id: 4,
      name: "employee",
      display_name: "Employee",
      description: "Standard employee with basic access",
      hierarchy_level: 4,
      can_approve_leave: "none",
      can_approve_onduty: "none",
      can_manage_users: "none",
      can_manage_leave_types: false,
      can_view_reports: "none",
      can_access_webapp: false,
      can_manage_roles: false,
      can_manage_email_settings: false,
      can_manage_active_onduty: "none",
      can_manage_schedule: "none",
      can_view_activities: "none",
      active: true
    }
  ];

  for (const r of roles) {
    const [role, created] = await Role.findOrCreate({
      where: { id: r.id },
      defaults: r
    });

    if (!created) {
      await role.update(r);
      console.log(`Updated role: ${r.name}`);
    } else {
      console.log(`Created role: ${r.name}`);
    }
  }
}

module.exports = seedRoles;

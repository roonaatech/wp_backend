module.exports = (sequelize, Sequelize) => {
    const Role = sequelize.define("roles", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        display_name: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        hierarchy_level: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Lower number = higher authority. 0=highest, 999=lowest'
        },
        // Hierarchical permissions - 'none', 'subordinates', 'all'
        can_approve_leave: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'none=no access, subordinates=only subordinates, all=everyone'
        },
        can_approve_onduty: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'none=no access, subordinates=only subordinates, all=everyone'
        },
        can_approve_timeoff: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'none=no access, subordinates=only subordinates, all=everyone'
        },
        can_manage_users: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'none=no access, subordinates=only subordinates, all=everyone'
        },
        can_view_users: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'View only access to users - none=no access, subordinates=only subordinates, all=everyone'
        },
        can_view_reports: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'none=no access, subordinates=only subordinates, all=everyone'
        },
        can_manage_active_onduty: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'Manage active on-duty records - none=no access, subordinates=only subordinates, all=everyone'
        },
        can_manage_schedule: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'View schedule/calendar - none=no access, subordinates=only subordinates, all=everyone'
        },
        can_view_activities: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'View activity logs - none=no access, subordinates=only subordinates, all=everyone'
        },
        // Global permissions - boolean (either you have it or not)
        can_manage_leave_types: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        can_access_webapp: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can access the web application dashboard'
        },
        can_manage_roles: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can manage roles'
        },
        can_manage_service_accounts: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can manage service accounts'
        },
        can_manage_email_settings: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can manage email settings'
        },
        can_manage_onboarding: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can manage onboarding processes'
        },
        can_view_birthdays: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can view staff birthdays on the dashboard and receive the birthday digest'
        },
        can_view_anniversaries: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can view staff work anniversaries on the dashboard and receive the anniversary digest'
        },
        can_manage_system_settings: {
            type: Sequelize.ENUM('none', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'Manage system settings - none=no access, all=access'
        },
        can_access_attendance_portal: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        can_view_attendance_report: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none'
        },
        can_manage_attendance: {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none'
        },
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'roles',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['name']
            }
        ]
    });

    return Role;
};

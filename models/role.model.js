module.exports = (sequelize, Sequelize) => {
    const Role = sequelize.define("roles", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING(50),
            allowNull: false,
            unique: true
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
        can_manage_email_settings: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Can manage email settings'
        },
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'roles',
        timestamps: true
    });

    return Role;
};

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
        can_approve_leave: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        can_approve_onduty: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        can_manage_users: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        can_manage_leave_types: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        can_view_reports: {
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

module.exports = (sequelize, Sequelize) => {
    const ActivityLog = sequelize.define("ActivityLog", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        action: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Action type: CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT"
        },
        entity: {
            type: Sequelize.STRING,
            allowNull: false,
            comment: "Entity type: User, LeaveRequest, OnDutyLog, LeaveType, etc."
        },
        entity_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: "ID of the affected entity"
        },
        admin_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: "ID of the admin/manager/employee performing the action"
        },
        affected_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: "ID of the user being affected by the action"
        },
        old_values: {
            type: Sequelize.JSON,
            allowNull: true,
            comment: "Previous values before update"
        },
        new_values: {
            type: Sequelize.JSON,
            allowNull: true,
            comment: "New values after update"
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: "Human-readable description of the action"
        },
        ip_address: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "IP address of the user making the request"
        },
        user_agent: {
            type: Sequelize.STRING,
            allowNull: true,
            comment: "Browser/client user agent"
        },
        createdAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
            allowNull: false
        }
    }, {
        timestamps: false,
        tableName: 'activity_logs',
        indexes: [
            { fields: ['admin_id'] },
            { fields: ['affected_user_id'] },
            { fields: ['action'] },
            { fields: ['entity'] },
            { fields: ['createdAt'] }
        ]
    });

    return ActivityLog;
};

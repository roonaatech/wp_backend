module.exports = (sequelize, Sequelize) => {
    const UserLeaveType = sequelize.define("user_leave_types", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        leave_type_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        days_allowed: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        days_used: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        tableName: 'user_leave_types',
        timestamps: false
    });

    return UserLeaveType;
};

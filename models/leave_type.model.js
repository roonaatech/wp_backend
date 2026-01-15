module.exports = (sequelize, Sequelize) => {
    const LeaveType = sequelize.define("leave_type", {
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        description: {
            type: Sequelize.STRING
        },
        days_allowed: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        status: {
            type: Sequelize.BOOLEAN, // true = active, false = inactive
            defaultValue: true
        },
        gender_restriction: {
            type: Sequelize.JSON,
            allowNull: true
        }
    });

    return LeaveType;
};

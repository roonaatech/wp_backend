module.exports = (sequelize, Sequelize) => {
    const LeaveRequest = sequelize.define("leave_requests", {
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        leave_type: {
            type: Sequelize.STRING, // e.g., 'Sick', 'Casual', 'Earned'
            allowNull: false
        },
        start_date: {
            type: Sequelize.DATEONLY,
            allowNull: false
        },
        end_date: {
            type: Sequelize.DATEONLY,
            allowNull: false
        },
        reason: {
            type: Sequelize.TEXT
        },
        status: {
            type: Sequelize.STRING,
            defaultValue: 'Pending' // Pending, Approved, Rejected
        },
        manager_id: {
            type: Sequelize.INTEGER
        },
        rejection_reason: {
            type: Sequelize.TEXT
        }
    });

    return LeaveRequest;
};

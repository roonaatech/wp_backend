module.exports = (sequelize, Sequelize) => {
    const TimeOffRequest = sequelize.define("time_off_requests", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        date: {
            type: Sequelize.DATEONLY,
            allowNull: false
        },
        start_time: {
            type: Sequelize.TIME,
            allowNull: false
        },
        end_time: {
            type: Sequelize.TIME,
            allowNull: false
        },
        reason: {
            type: Sequelize.TEXT,
            allowNull: false
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

    return TimeOffRequest;
};

module.exports = (sequelize, Sequelize) => {
    const AttendanceLog = sequelize.define("attendance_logs", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        check_in_time: {
            type: Sequelize.DATE
        },
        check_out_time: {
            type: Sequelize.DATE
        },
        date: {
            type: Sequelize.DATEONLY,
            allowNull: false
        },
        phone_model: {
            type: Sequelize.STRING
        },
        ip_address: {
            type: Sequelize.STRING
        },
        latitude: {
            type: Sequelize.DECIMAL(10, 8)
        },
        longitude: {
            type: Sequelize.DECIMAL(11, 8)
        }
    });

    return AttendanceLog;
};

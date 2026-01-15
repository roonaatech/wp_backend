module.exports = (sequelize, Sequelize) => {
    const OnDutyLog = sequelize.define("on_duty_log", {
        staff_id: {
            type: Sequelize.INTEGER
        },
        client_name: {
            type: Sequelize.STRING
        },
        location: {
            type: Sequelize.STRING
        },
        purpose: {
            type: Sequelize.STRING
        },
        start_lat: {
            type: Sequelize.STRING
        },
        start_long: {
            type: Sequelize.STRING
        },
        start_time: {
            type: Sequelize.DATE
        },
        end_time: {
            type: Sequelize.DATE
        },
        end_lat: {
            type: Sequelize.STRING
        },
        end_long: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.STRING,
            defaultValue: 'Pending'
        },
        rejection_reason: {
            type: Sequelize.STRING
        },
        manager_id: {
            type: Sequelize.INTEGER
        }
    });

    return OnDutyLog;
};

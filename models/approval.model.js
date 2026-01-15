module.exports = (sequelize, Sequelize) => {
    const Approval = sequelize.define("approval", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        attendance_log_id: {
            type: Sequelize.INTEGER,
            allowNull: true
        },
        on_duty_log_id: {
            type: Sequelize.INTEGER,
            allowNull: true
        },
        manager_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        status: {
            type: Sequelize.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        },
        comments: {
            type: Sequelize.TEXT
        }
    });

    return Approval;
};

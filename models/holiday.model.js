module.exports = (sequelize, Sequelize) => {
    const Holiday = sequelize.define("holiday", {
        holiday_date: {
            type: Sequelize.DATEONLY,
            allowNull: false,
            primaryKey: true
        },
        holiday_name: {
            type: Sequelize.STRING(256),
            allowNull: false
        },
        date_added: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        },
        user_added: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        date_updated: {
            type: Sequelize.DATE,
            allowNull: true
        },
        user_updated: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        status: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1  // 1 = Active, 0 = Inactive
        }
    }, {
        tableName: 'holidays',
        timestamps: false
    });

    return Holiday;
};

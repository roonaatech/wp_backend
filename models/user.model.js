module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("users", {
        staffid: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        firstname: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        lastname: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        email: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        password: {
            type: Sequelize.STRING(250),
            allowNull: false
        },
        role: {
            type: Sequelize.INTEGER
        },
        active: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        admin: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        approving_manager_id: {
            type: Sequelize.INTEGER,
            comment: 'For managers: their approving admin. For employees: their reporting manager.'
        },
        gender: {
            type: Sequelize.ENUM('Male', 'Female', 'Transgender'),
            allowNull: true
        },
        datecreated: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        }
    }, {
        tableName: 'users',
        timestamps: false
    });

    return User;
};

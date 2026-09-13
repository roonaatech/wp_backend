module.exports = (sequelize, Sequelize) => {
    const ServiceAccount = sequelize.define("service_accounts", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        email: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: 'service_accounts_email_unique'
        },
        password: {
            type: Sequelize.STRING(250),
            allowNull: false
        },
        role_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'roles',
                key: 'id'
            }
        },
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        last_login: {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null
        }
    }, {
        tableName: 'service_accounts',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['email'],
                name: 'service_accounts_email_unique'
            }
        ]
    });

    return ServiceAccount;
};

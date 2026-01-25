'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Create email_configs table
        await queryInterface.createTable('email_configs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            provider_type: {
                type: Sequelize.ENUM('SMTP', 'API'),
                defaultValue: 'SMTP',
            },
            host: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            port: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            secure: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            auth_user: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            auth_pass: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            from_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            from_email: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            }
        });

        // 2. Create email_templates table
        await queryInterface.createTable('email_templates', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            slug: {
                type: Sequelize.STRING,
                unique: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            subject: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            body: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            variables_hint: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            cc_manager: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            }
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('email_configs');
        await queryInterface.dropTable('email_templates');
    }
};

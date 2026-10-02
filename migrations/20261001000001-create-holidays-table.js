'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes('holidays')) {
            await queryInterface.createTable('holidays', {
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
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
                    defaultValue: 1
                }
            });
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable('holidays');
    }
};

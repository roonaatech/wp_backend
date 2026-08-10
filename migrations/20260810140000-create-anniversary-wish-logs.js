'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tables = await queryInterface.showAllTables();
        const exists = tables.some(t => (typeof t === 'string' ? t : t.tableName) === 'anniversary_wish_logs');
        if (exists) return;

        await queryInterface.createTable('anniversary_wish_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            staff_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'staffid' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            wish_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
                comment: 'Calendar date (application timezone) the wish was sent for'
            },
            sent_to: {
                type: Sequelize.STRING(255),
                allowNull: true,
                comment: 'Comma separated addresses the wish was actually delivered to'
            },
            source: {
                type: Sequelize.ENUM('cron', 'manual'),
                allowNull: false,
                defaultValue: 'cron'
            },
            triggered_by: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            status: {
                type: Sequelize.ENUM('Sent', 'Failed'),
                allowNull: false,
                defaultValue: 'Sent'
            },
            error_message: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        // One wish per staff member per day — also guards concurrent sends
        await queryInterface.addIndex('anniversary_wish_logs', ['staff_id', 'wish_date'], {
            unique: true,
            name: 'anniversary_wish_logs_staff_date_unique'
        });
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('anniversary_wish_logs');
    }
};

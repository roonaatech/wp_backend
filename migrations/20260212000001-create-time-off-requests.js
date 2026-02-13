'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if table exists
        const tableExists = await queryInterface.showAllTables().then(tables => tables.includes('time_off_requests'));
        if (tableExists) {
            console.log('Table time_off_requests already exists, skipping creation.');
            return;
        }

        await queryInterface.createTable('time_off_requests', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
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
                defaultValue: 'Pending'
            },
            manager_id: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            rejection_reason: {
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

        // Add indexes for performance
        await queryInterface.addIndex('time_off_requests', ['staff_id']);
        await queryInterface.addIndex('time_off_requests', ['date']);
        await queryInterface.addIndex('time_off_requests', ['status']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('time_off_requests');
    }
};

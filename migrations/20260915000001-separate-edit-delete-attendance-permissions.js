'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');

        if (!tableInfo.can_edit_attendance) {
            await queryInterface.addColumn('roles', 'can_edit_attendance', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none'
            });
            console.log("Added column 'can_edit_attendance' to roles table.");
        } else {
            console.log("Column 'can_edit_attendance' already exists, skipping addition.");
        }

        if (!tableInfo.can_delete_attendance) {
            await queryInterface.addColumn('roles', 'can_delete_attendance', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none'
            });
            console.log("Added column 'can_delete_attendance' to roles table.");
        } else {
            console.log("Column 'can_delete_attendance' already exists, skipping addition.");
        }

        // Backfill values from can_manage_attendance if present
        if (tableInfo.can_manage_attendance) {
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_edit_attendance = can_manage_attendance,
                    can_delete_attendance = can_manage_attendance
                WHERE can_manage_attendance IS NOT NULL AND can_manage_attendance != 'none'
            `);
            console.log("Backfilled can_edit_attendance and can_delete_attendance from can_manage_attendance.");
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_edit_attendance) {
            await queryInterface.removeColumn('roles', 'can_edit_attendance');
        }
        if (tableInfo.can_delete_attendance) {
            await queryInterface.removeColumn('roles', 'can_delete_attendance');
        }
    }
};

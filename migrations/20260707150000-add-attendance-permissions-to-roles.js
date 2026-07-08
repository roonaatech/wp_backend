'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('roles');

        if (!tableInfo.can_access_attendance_portal) {
            await queryInterface.addColumn('roles', 'can_access_attendance_portal', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            });
        }

        if (!tableInfo.can_view_attendance_report) {
            await queryInterface.addColumn('roles', 'can_view_attendance_report', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none'
            });
        }

        if (!tableInfo.can_manage_attendance) {
            await queryInterface.addColumn('roles', 'can_manage_attendance', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none'
            });
        }

        // Backfill existing roles with appropriate default values for attendance permissions
        await queryInterface.sequelize.query(`
            UPDATE roles 
            SET can_access_attendance_portal = true, 
                can_view_attendance_report = 'all', 
                can_manage_attendance = 'all'
            WHERE name IN ('super_admin', 'admin', 'human_resource')
        `);

        await queryInterface.sequelize.query(`
            UPDATE roles 
            SET can_view_attendance_report = 'subordinates'
            WHERE name = 'manager'
        `);
    },

    down: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('roles');

        if (tableInfo.can_access_attendance_portal) {
            await queryInterface.removeColumn('roles', 'can_access_attendance_portal');
        }
        if (tableInfo.can_view_attendance_report) {
            await queryInterface.removeColumn('roles', 'can_view_attendance_report');
        }
        if (tableInfo.can_manage_attendance) {
            await queryInterface.removeColumn('roles', 'can_manage_attendance');
        }
    }
};

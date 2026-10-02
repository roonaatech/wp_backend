'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_manage_holidays) {
            await queryInterface.addColumn('roles', 'can_manage_holidays', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Can view and manage company holidays'
            });

            // Grant permission to Super Admin (hierarchy_level <= 1) and any role that already had can_manage_leave_types
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_manage_holidays = true 
                WHERE hierarchy_level <= 1 OR can_manage_leave_types = true
            `);
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_manage_holidays) {
            await queryInterface.removeColumn('roles', 'can_manage_holidays');
        }
    }
};

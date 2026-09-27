'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_manage_manual_attendance) {
            await queryInterface.addColumn('roles', 'can_manage_manual_attendance', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Can add manual attendance for employees working from home or missed check-in/out'
            });

            // Set default to true for super_admin (hierarchy_level <= 1) and human_resource
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_manage_manual_attendance = true 
                WHERE hierarchy_level <= 1 OR name = 'human_resource'
            `);
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_manage_manual_attendance) {
            await queryInterface.removeColumn('roles', 'can_manage_manual_attendance');
        }
    }
};

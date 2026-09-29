'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_view_dashboard) {
            await queryInterface.addColumn('roles', 'can_view_dashboard', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Allows users with this role to view dashboard items (metrics, charts, approvals, activity). If false, a blank dashboard is shown.'
            });

            // Set default to true for Super Admin, Admin, Manager, and HR
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_view_dashboard = true 
                WHERE hierarchy_level <= 2 OR name IN ('super_admin', 'admin', 'manager', 'human_resource')
            `);
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_view_dashboard) {
            await queryInterface.removeColumn('roles', 'can_view_dashboard');
        }
    }
};

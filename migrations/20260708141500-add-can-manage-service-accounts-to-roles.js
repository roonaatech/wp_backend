'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_manage_service_accounts) {
            await queryInterface.addColumn('roles', 'can_manage_service_accounts', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                after: 'can_manage_roles'
            });

            // Set default to true for super_admin (hierarchy_level = 0) and admin (hierarchy_level = 1)
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_manage_service_accounts = true 
                WHERE hierarchy_level <= 1
            `);
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('roles', 'can_manage_service_accounts');
    }
};

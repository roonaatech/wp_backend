'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_manage_modules) {
            await queryInterface.addColumn('roles', 'can_manage_modules', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Can view and configure system modules'
            });

            // Grant permission to Super Admin (hierarchy_level <= 1) and any role with can_manage_system_settings = 'all'
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_manage_modules = true 
                WHERE hierarchy_level <= 1 OR can_manage_system_settings = 'all'
            `);
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_manage_modules) {
            await queryInterface.removeColumn('roles', 'can_manage_modules');
        }
    }
};

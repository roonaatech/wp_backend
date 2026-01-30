'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add can_manage_roles column
        await queryInterface.addColumn('roles', 'can_manage_roles', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            after: 'can_access_webapp'
        });

        // Add can_manage_email_settings column
        await queryInterface.addColumn('roles', 'can_manage_email_settings', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            after: 'can_manage_roles'
        });

        // Update Admin role to have these permissions (assuming Admin has hierarchy_level = 1)
        await queryInterface.sequelize.query(`
            UPDATE roles 
            SET can_manage_roles = true, can_manage_email_settings = true 
            WHERE hierarchy_level = 1 OR name = 'admin'
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('roles', 'can_manage_roles');
        await queryInterface.removeColumn('roles', 'can_manage_email_settings');
    }
};

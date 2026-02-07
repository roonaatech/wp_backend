'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add can_view_users column to roles table
        await queryInterface.addColumn('roles', 'can_view_users', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            after: 'can_manage_users'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('roles', 'can_view_users');
        // Remove the ENUM type
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_roles_can_view_users";');
    }
};

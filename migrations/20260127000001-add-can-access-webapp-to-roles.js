'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add can_access_webapp column to roles table
        await queryInterface.addColumn('roles', 'can_access_webapp', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            after: 'can_view_reports'
        });

        // Update existing roles to have can_access_webapp = true for Admin, Leader, Manager
        // (hierarchy_level <= 3)
        await queryInterface.sequelize.query(`
            UPDATE roles 
            SET can_access_webapp = true 
            WHERE hierarchy_level <= 3
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('roles', 'can_access_webapp');
    }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');

        if (!tableInfo.can_register_face_id) {
            await queryInterface.addColumn('roles', 'can_register_face_id', {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false
            });
            console.log("Added column 'can_register_face_id' to roles table.");

            // Set true for Super Admin and Admin (hierarchy_level <= 1)
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_register_face_id = true 
                WHERE hierarchy_level <= 1 AND active = 1
            `);
            console.log("Updated Super Admin and Admin roles with can_register_face_id = true.");
        } else {
            console.log("Column 'can_register_face_id' already exists, skipping addition.");
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_register_face_id) {
            await queryInterface.removeColumn('roles', 'can_register_face_id');
        }
    }
};

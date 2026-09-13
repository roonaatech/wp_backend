'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        console.log("Cleaning up orphaned user_leave_types records...");
        
        // 1. Delete rows pointing to non-existent leave types
        const [result1] = await queryInterface.sequelize.query(`
            DELETE FROM user_leave_types 
            WHERE leave_type_id NOT IN (SELECT id FROM leave_types)
        `);
        console.log(`Removed orphaned leave type associations.`);

        // 2. Delete rows pointing to non-existent users
        const [result2] = await queryInterface.sequelize.query(`
            DELETE FROM user_leave_types 
            WHERE user_id NOT IN (SELECT staffid FROM users)
        `);
        console.log(`Removed orphaned user associations.`);
    },

    async down(queryInterface, Sequelize) {
        // Cleaning up orphaned records is a non-reversible corrective DDL/DML operation
    }
};

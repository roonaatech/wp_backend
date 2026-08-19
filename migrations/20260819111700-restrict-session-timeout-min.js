'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Update the validation rules for session_timeout to enforce a minimum of 24 hours
        await queryInterface.sequelize.query(
            "UPDATE settings SET validation_rules = '{\"min\": 24, \"max\": 8760, \"step\": 1, \"required\": true}' WHERE `key` = 'session_timeout'"
        );
        
        // Also update any existing values that might be set to less than 24 hours to a minimum of 24 hours
        await queryInterface.sequelize.query(
            "UPDATE settings SET value = '24' WHERE `key` = 'session_timeout' AND CAST(value AS SIGNED) < 24"
        );
    },

    async down(queryInterface, Sequelize) {
        // Rollback validation rules to a minimum of 1 hour
        await queryInterface.sequelize.query(
            "UPDATE settings SET validation_rules = '{\"min\": 1, \"max\": 8760, \"step\": 1, \"required\": true}' WHERE `key` = 'session_timeout'"
        );
    }
};

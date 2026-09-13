'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Update the validation rules for inactivity_timeout to enforce a minimum of 3 minutes
        await queryInterface.sequelize.query(
            "UPDATE settings SET validation_rules = '{\"min\": 3, \"max\": 1440, \"step\": 1, \"required\": true}' WHERE `key` = 'inactivity_timeout'"
        );
        
        // Also update any existing values that might be set to less than 3 minutes to a minimum of 3 minutes
        await queryInterface.sequelize.query(
            "UPDATE settings SET value = '3' WHERE `key` = 'inactivity_timeout' AND CAST(value AS SIGNED) < 3"
        );
    },

    async down(queryInterface, Sequelize) {
        // Rollback validation rules to a minimum of 1 minute
        await queryInterface.sequelize.query(
            "UPDATE settings SET validation_rules = '{\"min\": 1, \"max\": 1440, \"step\": 1, \"required\": true}' WHERE `key` = 'inactivity_timeout'"
        );
    }
};

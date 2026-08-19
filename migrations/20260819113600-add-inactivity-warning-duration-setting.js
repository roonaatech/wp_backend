'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Insert inactivity_warning_duration key into settings
        await queryInterface.sequelize.query(
            `INSERT INTO settings (\`key\`, \`value\`, \`description\`, \`category\`, \`data_type\`, \`validation_rules\`, \`is_public\`, \`display_order\`, \`createdAt\`, \`updatedAt\`) 
            VALUES (
                'inactivity_warning_duration', 
                '60', 
                'Countdown duration (in seconds) to show the logout warning popup before signing out', 
                'general', 
                'number', 
                '{"min": 10, "max": 300, "step": 1, "required": true}', 
                0, 
                16, 
                NOW(), 
                NOW()
            ) ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`);`
        );
    },

    async down(queryInterface, Sequelize) {
        // Delete inactivity_warning_duration key
        await queryInterface.sequelize.query(
            "DELETE FROM settings WHERE `key` = 'inactivity_warning_duration'"
        );
    }
};

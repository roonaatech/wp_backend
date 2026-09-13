'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // Check if session_timeout already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'session_timeout'"
        );

        if (existing.length === 0) {
            // Add session_timeout setting
            await queryInterface.bulkInsert('settings', [{
                key: 'session_timeout',
                value: '168',
                description: 'Session timeout duration (in hours) before users are logged out',
                category: 'general',
                data_type: 'number',
                validation_rules: '{"min": 1, "max": 8760, "step": 1, "required": true}',
                is_public: false,
                display_order: 14,
                createdAt: now,
                updatedAt: now
            }]);
        } else {
            console.log("Setting 'session_timeout' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'session_timeout' });
    }
};

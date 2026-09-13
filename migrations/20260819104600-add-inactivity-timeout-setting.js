'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // Check if inactivity_timeout already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'inactivity_timeout'"
        );

        if (existing.length === 0) {
            // Add inactivity_timeout setting
            await queryInterface.bulkInsert('settings', [{
                key: 'inactivity_timeout',
                value: '5',
                description: 'Idle inactivity duration (in minutes) before showing the session logout warning popup',
                category: 'general',
                data_type: 'number',
                validation_rules: '{"min": 1, "max": 1440, "step": 1, "required": true}',
                is_public: false,
                display_order: 15,
                createdAt: now,
                updatedAt: now
            }]);
        } else {
            console.log("Setting 'inactivity_timeout' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'inactivity_timeout' });
    }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if application_timezone already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'application_timezone'"
        );

        if (existing.length === 0) {
            // Add application_timezone setting
            await queryInterface.bulkInsert('settings', [{
                key: 'application_timezone',
                value: 'America/Chicago',
                description: 'Timezone used for displaying dates and times throughout the application',
                category: 'general',
                data_type: 'string',
                validation_rules: '{"required": true}',
                is_public: true,
                display_order: 10,
                createdAt: new Date(),
                updatedAt: new Date()
            }]);
        } else {
            console.log("Setting 'application_timezone' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'application_timezone' });
    }
};

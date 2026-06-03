'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // Check if google_maps_api_key already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'google_maps_api_key'"
        );

        if (existing.length === 0) {
            // Add google_maps_api_key setting
            await queryInterface.bulkInsert('settings', [{
                key: 'google_maps_api_key',
                value: 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8',
                description: 'API key used to display Google Maps on-duty routes and location details',
                category: 'general',
                data_type: 'string',
                validation_rules: '{"required": false}',
                is_public: true,
                display_order: 13,
                createdAt: now,
                updatedAt: now
            }]);
        } else {
            console.log("Setting 'google_maps_api_key' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'google_maps_api_key' });
    }
};

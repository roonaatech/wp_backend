'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'time_off_past_days_allowed'"
        );

        if (existing.length === 0) {
            await queryInterface.bulkInsert('settings', [{
                key: 'time_off_past_days_allowed',
                value: '0',
                description: 'Number of past days users can select when applying for time-off (0 = only today and future)',
                category: 'time_off',
                data_type: 'number',
                validation_rules: '{"min": 0, "max": 365, "step": 1, "required": true}',
                is_public: true,
                display_order: 3,
                createdAt: now,
                updatedAt: now
            }]);
            console.log("Setting 'time_off_past_days_allowed' created with default 0 days.");
        } else {
            console.log("Setting 'time_off_past_days_allowed' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', {
            key: 'time_off_past_days_allowed'
        });
    }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // 1. Check & Insert allowed_leave_per_month
        const [existingLeave] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'allowed_leave_per_month'"
        );

        if (existingLeave.length === 0) {
            await queryInterface.bulkInsert('settings', [{
                key: 'allowed_leave_per_month',
                value: '1',
                description: 'Allowed paid leave days per month for salary processing and compliance calculation',
                category: 'leave',
                data_type: 'number',
                validation_rules: '{"min": 0, "max": 31, "step": 0.5, "required": true}',
                is_public: true,
                display_order: 21,
                createdAt: now,
                updatedAt: now
            }]);
            console.log("Setting 'allowed_leave_per_month' created with default 1 day.");
        } else {
            console.log("Setting 'allowed_leave_per_month' already exists, skipping insertion.");
        }

        // 2. Check & Insert allowed_time_off_per_month
        const [existingTimeOff] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'allowed_time_off_per_month'"
        );

        if (existingTimeOff.length === 0) {
            await queryInterface.bulkInsert('settings', [{
                key: 'allowed_time_off_per_month',
                value: '2',
                description: 'Allowed time-off hours per month credited towards daily attendance compliance for salary processing',
                category: 'time_off',
                data_type: 'number',
                validation_rules: '{"min": 0, "max": 100, "step": 0.5, "required": true}',
                is_public: true,
                display_order: 2,
                createdAt: now,
                updatedAt: now
            }]);
            console.log("Setting 'allowed_time_off_per_month' created with default 2 hours.");
        } else {
            console.log("Setting 'allowed_time_off_per_month' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        const { Op } = Sequelize;
        await queryInterface.bulkDelete('settings', {
            key: {
                [Op.in]: ['allowed_leave_per_month', 'allowed_time_off_per_month']
            }
        });
    }
};

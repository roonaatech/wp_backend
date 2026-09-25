'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // Check if attendance_compliance_hours already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'attendance_compliance_hours'"
        );

        if (existing.length === 0) {
            await queryInterface.bulkInsert('settings', [{
                key: 'attendance_compliance_hours',
                value: '8',
                description: 'Minimum required hours an employee must be in office per day for attendance compliance',
                category: 'attendance',
                data_type: 'number',
                validation_rules: '{"min": 1, "max": 24, "step": 0.5, "required": true}',
                is_public: true,
                display_order: 1,
                createdAt: now,
                updatedAt: now
            }]);
            console.log("Setting 'attendance_compliance_hours' created with default 8 hours.");
        } else {
            console.log("Setting 'attendance_compliance_hours' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'attendance_compliance_hours' });
    }
};

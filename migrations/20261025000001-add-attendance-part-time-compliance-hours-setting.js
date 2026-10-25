'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // Check if attendance_compliance_hours_part_time already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'attendance_compliance_hours_part_time'"
        );

        if (existing.length === 0) {
            await queryInterface.bulkInsert('settings', [{
                key: 'attendance_compliance_hours_part_time',
                value: '4.5',
                description: 'Minimum required hours (attendance + time-off + on-duty) an employee must complete per day for part-time attendance compliance',
                category: 'attendance',
                data_type: 'number',
                validation_rules: '{"min": 0.5, "max": 24, "step": 0.5, "required": true}',
                is_public: true,
                display_order: 2,
                createdAt: now,
                updatedAt: now
            }]);
            console.log("Setting 'attendance_compliance_hours_part_time' created with default 4.5 hours.");
        } else {
            console.log("Setting 'attendance_compliance_hours_part_time' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'attendance_compliance_hours_part_time' });
    }
};

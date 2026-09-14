'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const now = new Date();

        // Check if remove_face_roles setting already exists
        const [existing] = await queryInterface.sequelize.query(
            "SELECT `key` FROM settings WHERE `key` = 'remove_face_roles'"
        );

        if (existing.length === 0) {
            // Find roles with hierarchy_level <= 1 (Super Admin and Admin)
            const [roles] = await queryInterface.sequelize.query(
                "SELECT id FROM roles WHERE hierarchy_level <= 1 AND active = 1 ORDER BY hierarchy_level ASC, id ASC"
            );
            const defaultRoleIds = roles.map(r => r.id).join(',');

            await queryInterface.bulkInsert('settings', [{
                key: 'remove_face_roles',
                value: defaultRoleIds || '1,3',
                description: 'Comma separated role IDs that have permission to remove or reset employee Face ID biometric data in the web application.',
                category: 'face_id',
                data_type: 'string',
                validation_rules: null,
                is_public: false,
                display_order: 40,
                createdAt: now,
                updatedAt: now
            }]);
            console.log(`Initialized 'remove_face_roles' setting with default roles: ${defaultRoleIds || '1,3'}`);
        } else {
            console.log("Setting 'remove_face_roles' already exists, skipping insertion.");
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('settings', { key: 'remove_face_roles' });
    }
};

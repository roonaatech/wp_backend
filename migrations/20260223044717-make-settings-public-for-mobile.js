'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1. Ensure application_date_format exists and is public
    const [dateSetting] = await queryInterface.sequelize.query(
      "SELECT `key` FROM settings WHERE `key` = 'application_date_format'"
    );

    if (dateSetting.length === 0) {
      await queryInterface.bulkInsert('settings', [{
        key: 'application_date_format',
        value: 'MMM DD, YYYY',
        description: 'Global format used to display dates across the application',
        category: 'general',
        data_type: 'string',
        validation_rules: '{"required": true}',
        is_public: true,
        display_order: 11,
        createdAt: now,
        updatedAt: now
      }]);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE settings 
        SET is_public = true, 
            description = 'Global format used to display dates across the application',
            category = 'general',
            display_order = 11,
            updatedAt = NOW()
        WHERE \`key\` = 'application_date_format'
      `);
    }

    // 2. Ensure application_time_format exists and is public
    const [timeSetting] = await queryInterface.sequelize.query(
      "SELECT \`key\` FROM settings WHERE \`key\` = 'application_time_format'"
    );

    if (timeSetting.length === 0) {
      await queryInterface.bulkInsert('settings', [{
        key: 'application_time_format',
        value: '12h',
        description: 'Global format used to display times across the application',
        category: 'general',
        data_type: 'string',
        validation_rules: '{"required": true}',
        is_public: true,
        display_order: 12,
        createdAt: now,
        updatedAt: now
      }]);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE settings 
        SET is_public = true, 
            description = 'Global format used to display times across the application',
            category = 'general',
            display_order = 12,
            updatedAt = NOW()
        WHERE \`key\` = 'application_time_format'
      `);
    }

    // 3. Ensure application_timezone is public (already should be, but let's be sure)
    await queryInterface.sequelize.query(`
      UPDATE settings 
      SET is_public = true 
      WHERE \`key\` = 'application_timezone'
    `);
  },

  async down(queryInterface, Sequelize) {
    // We don't necessarily want to delete them, but we could make them non-public
    await queryInterface.sequelize.query(`
      UPDATE settings 
      SET is_public = false 
      WHERE \`key\` IN ('application_date_format', 'application_time_format')
    `);
  }
};

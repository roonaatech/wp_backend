'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add new columns to make settings table more generic
        await queryInterface.addColumn('settings', 'category', {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: 'general',
            comment: 'Category for grouping settings (e.g., time_off, email, security, appearance)'
        });

        await queryInterface.addColumn('settings', 'data_type', {
            type: Sequelize.ENUM('string', 'number', 'boolean', 'json', 'date', 'email', 'url'),
            allowNull: false,
            defaultValue: 'string',
            comment: 'Data type for validation and UI rendering'
        });

        await queryInterface.addColumn('settings', 'validation_rules', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'JSON string with validation rules (e.g., {"min": 0, "max": 24, "required": true})'
        });

        await queryInterface.addColumn('settings', 'is_public', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this setting can be accessed without authentication (for public configs)'
        });

        await queryInterface.addColumn('settings', 'display_order', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0,
            comment: 'Order for displaying in UI'
        });

        // Update existing max_time_off_hours setting with metadata
        // Note: Using backticks around 'key' because it's a reserved word in MySQL
        await queryInterface.sequelize.query(`
      UPDATE settings 
      SET 
        category = 'time_off',
        data_type = 'number',
        validation_rules = '{"min": 0.5, "max": 24, "step": 0.5, "required": true}',
        display_order = 1
      WHERE \`key\` = 'max_time_off_hours'
    `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('settings', 'category');
        await queryInterface.removeColumn('settings', 'data_type');
        await queryInterface.removeColumn('settings', 'validation_rules');
        await queryInterface.removeColumn('settings', 'is_public');
        await queryInterface.removeColumn('settings', 'display_order');
    }
};

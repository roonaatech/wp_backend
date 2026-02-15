module.exports = (sequelize, Sequelize) => {
    const Setting = sequelize.define("settings", {
        key: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
            comment: 'Unique identifier for the setting (e.g., max_time_off_hours, smtp_host)'
        },
        value: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Setting value stored as text (can be JSON for complex types)'
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Human-readable description of what this setting does'
        },
        category: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: 'general',
            comment: 'Category for grouping settings (e.g., time_off, email, security, appearance)'
        },
        data_type: {
            type: Sequelize.ENUM('string', 'number', 'boolean', 'json', 'date', 'email', 'url'),
            allowNull: false,
            defaultValue: 'string',
            comment: 'Data type for validation and UI rendering'
        },
        validation_rules: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'JSON string with validation rules (e.g., {"min": 0, "max": 24, "required": true})'
        },
        is_public: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this setting can be accessed without authentication (for public configs)'
        },
        display_order: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0,
            comment: 'Order for displaying in UI'
        },
        updated_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Staff ID of the user who last updated this setting'
        }
    });

    return Setting;
};

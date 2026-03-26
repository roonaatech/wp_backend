const db = require("../models");
const Setting = db.settings;

async function seedSettings() {
    const settings = [
        {
            key: 'max_time_off_hours',
            value: '4',
            description: 'Maximum allowed hours for a single time-off request per day',
            category: 'time_off',
            data_type: 'number',
            validation_rules: '{"min": 0.5, "max": 24, "step": 0.5, "required": true}',
            is_public: false,
            display_order: 1
        },
        {
            key: 'application_timezone',
            value: 'Asia/Kolkata',
            description: 'Timezone used for displaying dates and times throughout the application',
            category: 'general',
            data_type: 'string',
            validation_rules: '{"required": true}',
            is_public: true,
            display_order: 10
        },
        {
            key: 'application_date_format',
            value: 'DD/MM/YYYY',
            description: 'Global format used to display dates across the application',
            category: 'general',
            data_type: 'string',
            validation_rules: null,
            is_public: true,
            display_order: 11
        },
        {
            key: 'application_time_format',
            value: '12h',
            description: 'Global format used to display times across the application',
            category: 'general',
            data_type: 'string',
            validation_rules: null,
            is_public: true,
            display_order: 12
        }
    ];

    for (const s of settings) {
        const [setting, created] = await Setting.findOrCreate({
            where: { key: s.key },
            defaults: s
        });

        if (!created) {
            console.log(`Setting already exists, skipping update: ${s.key}`);
            // Note: Existing settings are preserved to maintain production customizations
            // To force update settings, use the admin panel or manually update the database
        } else {
            console.log(`Created setting: ${s.key}`);
        }
    }
}

module.exports = seedSettings;

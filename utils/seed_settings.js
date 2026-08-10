const db = require("../models");
const Setting = db.settings;

async function seedSettings() {
    // Default the birthday digest to whichever roles currently hold the
    // can_view_birthdays permission.
    let defaultDigestRoleIds = '';
    try {
        const { getBirthdayPermittedRoleIds } = require("./birthday.util");
        defaultDigestRoleIds = (await getBirthdayPermittedRoleIds()).sort((a, b) => a - b).join(',');
    } catch (e) {
        console.warn('Could not resolve default birthday digest roles; leaving blank (falls back to the birthday permission).');
    }

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
        },
        {
            key: 'leave_past_days_allowed',
            value: '0',
            description: 'Number of past days users can select when applying for leave (0 = only today and future)',
            category: 'leave',
            data_type: 'number',
            validation_rules: '{"min": 0, "max": 365, "step": 1, "required": true}',
            is_public: false,
            display_order: 20
        },
        {
            key: 'enable_pending_request_reminders',
            value: 'true',
            description: 'Enable or disable daily automated email reminders for pending requests.',
            category: 'notifications',
            data_type: 'boolean',
            validation_rules: null,
            is_public: false,
            display_order: 30
        },
        {
            key: 'pending_request_reminder_days',
            value: '3',
            description: 'Number of days a request must be pending before a reminder is sent to the manager.',
            category: 'notifications',
            data_type: 'number',
            validation_rules: '{"min": 1, "max": 30, "step": 1, "required": true}',
            is_public: false,
            display_order: 31
        },
        {
            key: 'pending_request_reminder_schedule',
            value: '0 8 * * *',
            description: 'Cron schedule expression for when the reminder job should run (default: 0 8 * * * means 8:00 AM daily).',
            category: 'notifications',
            data_type: 'string',
            validation_rules: null,
            is_public: false,
            display_order: 32
        },
        {
            key: 'enable_birthday_notifications',
            value: 'true',
            description: 'Master switch for the daily birthday job (wish emails to celebrants and the digest to HR and higher hierarchy users).',
            category: 'notifications',
            data_type: 'boolean',
            validation_rules: null,
            is_public: false,
            display_order: 33
        },
        {
            key: 'birthday_digest_recipient_roles',
            value: defaultDigestRoleIds,
            description: 'Comma separated role IDs that receive the daily birthday digest email. Leave blank to fall back to Human Resource and higher hierarchy roles.',
            category: 'notifications',
            data_type: 'string',
            validation_rules: null,
            is_public: false,
            display_order: 36
        },
        {
            key: 'enable_birthday_wish_emails',
            value: 'true',
            description: 'Send a birthday wish email to the staff member on their birthday, using the "Birthday Wish" email template. Turn off to send only the HR digest.',
            category: 'notifications',
            data_type: 'boolean',
            validation_rules: null,
            is_public: false,
            display_order: 35
        },
        {
            key: 'birthday_notification_schedule',
            value: '0 8 * * *',
            description: 'Cron schedule expression for the birthday digest email, evaluated in the application timezone (default: 0 8 * * * means 8:00 AM daily).',
            category: 'notifications',
            data_type: 'string',
            validation_rules: null,
            is_public: false,
            display_order: 34
        },
        {
            key: 'enable_anniversary_notifications',
            value: 'true',
            description: 'Master switch for the daily work anniversary job (wish emails to celebrants and the digest to HR and higher hierarchy users).',
            category: 'notifications',
            data_type: 'boolean',
            validation_rules: null,
            is_public: false,
            display_order: 37
        },
        {
            key: 'anniversary_digest_recipient_roles',
            value: defaultDigestRoleIds,
            description: 'Comma separated role IDs that receive the daily work anniversary digest email. Leave blank to fall back to Human Resource and higher hierarchy roles.',
            category: 'notifications',
            data_type: 'string',
            validation_rules: null,
            is_public: false,
            display_order: 40
        },
        {
            key: 'enable_anniversary_wish_emails',
            value: 'true',
            description: 'Send a work anniversary wish email to the staff member on their anniversary, using the "Work Anniversary Wish" email template. Turn off to send only the HR digest.',
            category: 'notifications',
            data_type: 'boolean',
            validation_rules: null,
            is_public: false,
            display_order: 39
        },
        {
            key: 'anniversary_notification_schedule',
            value: '0 8 * * *',
            description: 'Cron schedule expression for the work anniversary digest email, evaluated in the application timezone (default: 0 8 * * * means 8:00 AM daily).',
            category: 'notifications',
            data_type: 'string',
            validation_rules: null,
            is_public: false,
            display_order: 38
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

const db = require("../models");
const Setting = db.settings;
const { logActivity } = require('../utils/activity.logger');

// Get all settings or filter by category/key
exports.getSettings = async (req, res) => {
    try {
        const { key, category, include_public_only } = req.query;
        let query = {};

        if (key) {
            query.key = key;
        }

        if (category) {
            query.category = category;
        }

        // For public endpoints, only return public settings
        if (include_public_only === 'true') {
            query.is_public = true;
        }

        const settings = await Setting.findAll({
            where: query,
            order: [['display_order', 'ASC'], ['key', 'ASC']]
        });

        // Convert array to object key-value for easy frontend usage if no specific key requested
        if (!key) {
            const settingsMap = {};
            const settingsByCategory = {};

            settings.forEach(s => {
                settingsMap[s.key] = s.value;

                // Group by category
                if (!settingsByCategory[s.category || 'general']) {
                    settingsByCategory[s.category || 'general'] = [];
                }
                settingsByCategory[s.category || 'general'].push(s);
            });

            return res.status(200).send({
                settings: settings,
                map: settingsMap,
                byCategory: settingsByCategory
            });
        }

        res.status(200).send(settings);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Validate setting value based on data_type and validation_rules
const validateSettingValue = (value, data_type, validation_rules) => {
    let parsedRules = {};

    if (validation_rules) {
        try {
            parsedRules = JSON.parse(validation_rules);
        } catch (e) {
            // Invalid JSON, skip validation rules
        }
    }

    // Type validation
    switch (data_type) {
        case 'number':
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return { valid: false, message: 'Value must be a number' };
            }
            if (parsedRules.min !== undefined && numValue < parsedRules.min) {
                return { valid: false, message: `Value must be at least ${parsedRules.min}` };
            }
            if (parsedRules.max !== undefined && numValue > parsedRules.max) {
                return { valid: false, message: `Value must be at most ${parsedRules.max}` };
            }
            break;

        case 'boolean':
            if (value !== 'true' && value !== 'false' && value !== true && value !== false) {
                return { valid: false, message: 'Value must be true or false' };
            }
            break;

        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return { valid: false, message: 'Value must be a valid email address' };
            }
            break;

        case 'url':
            try {
                new URL(value);
            } catch (e) {
                return { valid: false, message: 'Value must be a valid URL' };
            }
            break;

        case 'json':
            try {
                JSON.parse(value);
            } catch (e) {
                return { valid: false, message: 'Value must be valid JSON' };
            }
            break;

        case 'date':
            if (isNaN(Date.parse(value))) {
                return { valid: false, message: 'Value must be a valid date' };
            }
            break;
    }

    // Required validation
    if (parsedRules.required && (!value || value.trim() === '')) {
        return { valid: false, message: 'This setting is required' };
    }

    return { valid: true };
};

// Update or create a setting
exports.updateSetting = async (req, res) => {
    try {
        const { key, value, description, category, data_type, validation_rules, is_public, display_order } = req.body;

        if (!key) {
            return res.status(400).send({ message: "Key is required." });
        }

        // Find existing setting to get its data_type and validation_rules
        const existingSetting = await Setting.findOne({ where: { key } });

        // Validate value if setting exists
        if (existingSetting) {
            const validation = validateSettingValue(
                value,
                existingSetting.data_type,
                existingSetting.validation_rules
            );

            if (!validation.valid) {
                return res.status(400).send({ message: validation.message });
            }
        }

        const [setting, created] = await Setting.findOrCreate({
            where: { key: key },
            defaults: {
                value: value,
                description: description,
                category: category || 'general',
                data_type: data_type || 'string',
                validation_rules: validation_rules,
                is_public: is_public || false,
                display_order: display_order || 0,
                updated_by: req.userId
            }
        });

        if (!created) {
            // Update existing setting
            setting.value = value;
            setting.updated_by = req.userId;

            // Allow updating metadata if provided
            if (description !== undefined) setting.description = description;
            if (category !== undefined) setting.category = category;
            if (data_type !== undefined) setting.data_type = data_type;
            if (validation_rules !== undefined) setting.validation_rules = validation_rules;
            if (is_public !== undefined) setting.is_public = is_public;
            if (display_order !== undefined) setting.display_order = display_order;

            await setting.save();
        }

        await logActivity({
            admin_id: req.userId,
            action: 'UPDATE',
            entity: 'Setting',
            entity_id: setting.id,
            description: `Updated system setting: ${key} to ${value}`,
            old_values: existingSetting ? { value: existingSetting.value } : null,
            new_values: { value: value },
            ip_address: req.ip || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent']
        });

        res.status(200).send({ message: "Setting updated successfully.", setting: setting });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get public settings (no authentication required)
exports.getPublicSettings = async (req, res) => {
    try {
        const settings = await Setting.findAll({
            where: { is_public: true },
            order: [['display_order', 'ASC'], ['key', 'ASC']]
        });

        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        res.status(200).send({ settings: settings, map: settingsMap });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};


const db = require("../models");
const EmailConfig = db.email_config;
const EmailTemplate = db.email_templates;
const emailService = require("../utils/email.service");

// Get Email Configuration
exports.getConfig = async (req, res) => {
    try {
        const config = await EmailConfig.findOne({ where: { is_active: true } });
        if (!config) {
            return res.status(404).send({ message: "No active configuration found." });
        }
        // Mask password in response?
        // config.auth_pass = "*****"; 
        // Usually admin needs to see it or we just don't return it if we want to be super secure, 
        // but for editing purposes, they might need it or we assume they will re-enter if changing.
        // simpler to return it for now or rely on secure boolean.
        res.status(200).send(config);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Update or Create Email Configuration
exports.updateConfig = async (req, res) => {
    try {
        const { provider_type, host, port, secure, auth_user, auth_pass, from_name, from_email } = req.body;

        // Deactivate old configs? Or just update the single one?
        // Assuming single config for now.
        let config = await EmailConfig.findOne();

        if (config) {
            config.provider_type = provider_type;
            config.host = host;
            config.port = port;
            config.secure = secure;
            config.auth_user = auth_user;
            config.auth_pass = auth_pass;
            config.from_name = from_name;
            config.from_email = from_email;
            await config.save();
        } else {
            config = await EmailConfig.create({
                provider_type, host, port, secure, auth_user, auth_pass, from_name, from_email
            });
        }

        res.status(200).send({ message: "Configuration saved successfully.", config });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Send Test Email
exports.sendTestEmail = async (req, res) => {
    try {
        const { to } = req.body;
        const result = await emailService.sendEmail(to, "Test Email from WorkPulse", "<h1>It Works!</h1><p>This is a test email from your WorkPulse Email Module.</p>");
        if (result.success) {
            res.status(200).send({ message: "Test email sent successfully.", messageId: result.messageId });
        } else {
            res.status(500).send({ message: "Failed to send email.", error: result.error });
        }
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get All Templates
exports.getTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.findAll();
        res.status(200).send(templates);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Update Template
exports.updateTemplate = async (req, res) => {
    const id = req.params.id;
    try {
        const [updated] = await EmailTemplate.update(req.body, { where: { id: id } });
        if (updated) {
            const updatedTemplate = await EmailTemplate.findByPk(id);
            res.status(200).send({ message: "Template updated successfully.", template: updatedTemplate });
        } else {
            res.status(404).send({ message: `Cannot update Template with id=${id}. Maybe Template was not found or req.body is empty!` });
        }
    } catch (err) {
        res.status(500).send({ message: "Error updating Template with id=" + id });
    }
};

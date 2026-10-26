const nodemailer = require("nodemailer");
const db = require("../models");
const EmailConfig = db.email_config;
const EmailTemplate = db.email_templates;

class EmailService {
    constructor() {
        this.transporter = null;
    }

    async getTransporter() {
        // Return existing transporter if valid?
        // For now, always fetch config to ensure latest settings are used.
        // In production, we might want to cache this and invalidate on config update.
        const config = await EmailConfig.findOne({ where: { is_active: true } });

        if (!config) {
            console.warn("No active email configuration found.");
            return null;
        }

        if (config.provider_type === 'SMTP') {
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure, // true for 465, false for other ports
                auth: {
                    user: config.auth_user,
                    pass: config.auth_pass,
                },
            });
            return { transporter, config };
        }

        // Add API provider logic here if needed in future
        return null;
    }

    async sendEmail(to, subject, htmlBody, cc = null) {
        try {
            const setup = await this.getTransporter();
            if (!setup) return { success: false, message: "Email configuration missing" };

            const { transporter, config } = setup;

            console.log(`[EmailService] Sending email to: ${to} | Subject: ${subject}`);
            if (cc) console.log(`[EmailService] CC: ${cc}`);

            const mailOptions = {
                from: `"${config.from_name}" <${config.from_email}>`,
                to: to,
                subject: subject,
                html: htmlBody,
            };

            if (cc) {
                mailOptions.cc = cc;
            }

            const info = await transporter.sendMail(mailOptions);

            console.log("Message sent: %s", info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error("Error sending email:", error);
            return { success: false, error: error.message };
        }
    }

    async sendTemplateEmail(to, templateSlug, variables, cc = null) {
        try {
            const template = await EmailTemplate.findOne({ where: { slug: templateSlug, is_active: true } });

            if (!template) {
                console.warn(`Email template '${templateSlug}' not found or inactive.`);
                return { success: false, message: "Template not found" };
            }

            let subject = template.subject;
            let body = template.body;

            // Fetch date/time settings for consistent email formatting
            const timezoneUtil = require("./timezone.util");
            const { timezone, dateFormat, timeFormat } = await timezoneUtil.getAppSettings();

            // Prepare formatted variables based on settings
            const formattedVariables = { ...(variables || {}) };
            for (const key in formattedVariables) {
                const val = formattedVariables[key];
                if (val === null || val === undefined) continue;

                if (val instanceof Date) {
                    if (key.includes('time') || (val.getHours() !== 0 || val.getMinutes() !== 0 || val.getSeconds() !== 0)) {
                        formattedVariables[key] = timezoneUtil.formatDateTime(val, timezone, dateFormat, timeFormat);
                    } else {
                        formattedVariables[key] = timezoneUtil.formatDateOnly(val, timezone, dateFormat);
                    }
                } else if (typeof val === 'string') {
                    const trimmed = val.trim();
                    // ISO Date Only: e.g. "2026-10-27"
                    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                        formattedVariables[key] = timezoneUtil.formatDateOnly(trimmed, timezone, dateFormat);
                    }
                    // ISO/SQL Datetime: e.g. "2026-10-27 09:30:00" or "2026-10-27T09:30:00" or "2026-10-27 09:30"
                    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(trimmed)) {
                        formattedVariables[key] = timezoneUtil.formatDateTime(trimmed, timezone, dateFormat, timeFormat);
                    }
                    // Pure Time: e.g. "09:30" or "14:30:00"
                    else if (key.includes('time') && /^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
                        formattedVariables[key] = timezoneUtil.formatTimeOnly(trimmed, timezone, timeFormat);
                    }
                }
            }

            // Ensure aliases for period/dates if one is provided
            if (!formattedVariables.start_date && formattedVariables.start_time) {
                formattedVariables.start_date = formattedVariables.start_time;
            }
            if (!formattedVariables.end_date && formattedVariables.end_time) {
                formattedVariables.end_date = formattedVariables.end_time;
            }

            // Replace variables
            for (const key in formattedVariables) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                subject = subject.replace(regex, formattedVariables[key]);
                body = body.replace(regex, formattedVariables[key]);
            }

            // Find user by primary email to check for secondary_email
            let userSecondaryEmail = null;
            try {
                const User = db.user;
                const userObj = await User.findOne({ where: { email: to } });
                if (userObj && userObj.secondary_email) {
                    userSecondaryEmail = userObj.secondary_email;
                }
            } catch (e) {
                console.error("Error looking up user for secondary email:", e);
            }

            // Use CC if template has cc_manager enabled and CC is provided
            let ccToUse = (template.cc_manager && cc) ? cc : null;

            // Add secondary email to CC if it exists
            if (userSecondaryEmail) {
                if (ccToUse) {
                    ccToUse = `${ccToUse},${userSecondaryEmail}`;
                } else {
                    ccToUse = userSecondaryEmail;
                }
            }

            return await this.sendEmail(to, subject, body, ccToUse);

        } catch (error) {
            console.error(`Error sending template email '${templateSlug}':`, error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();

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

            // Replace variables
            for (const key in variables) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                subject = subject.replace(regex, variables[key]);
                body = body.replace(regex, variables[key]);
            }

            // Use CC if template has cc_manager enabled and CC is provided
            const ccToUse = (template.cc_manager && cc) ? cc : null;

            return await this.sendEmail(to, subject, body, ccToUse);

        } catch (error) {
            console.error(`Error sending template email '${templateSlug}':`, error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();

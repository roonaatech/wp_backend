const db = require("../models");
const EmailTemplate = db.email_templates;

// Common styles for consistency
const PRIMARY_COLOR = "#1e293b";
const ACCENT_COLOR = "#3b82f6";
const BG_COLOR = "#f3f4f6";
const CONTAINER_BG = "#ffffff";
const TEXT_COLOR = "#1f2937";
const MUTED_TEXT = "#6b7280";

const header = `
<div style="background-color: ${BG_COLOR}; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: ${CONTAINER_BG}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: ${PRIMARY_COLOR}; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">WorkPulse</h1>
        </div>
        <div style="padding: 32px; color: ${TEXT_COLOR}; line-height: 1.6;">
`;

const footer = `
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: ${MUTED_TEXT};">
                &copy; ${new Date().getFullYear()} WorkPulse. All rights reserved.
            </p>
            <p style="margin: 5px 0 0; font-size: 12px; color: ${MUTED_TEXT};">
                This is an automated message, please do not reply.
            </p>
        </div>
    </div>
</div>
`;

const wrap = (content) => `${header}${content}${footer}`;

async function seedTemplates() {
    console.log("Email templates seeding is disabled.");
}

module.exports = seedTemplates;

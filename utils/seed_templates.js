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
    const templates = [
        {
            slug: "leave_applied",
            name: "Leave Applied",
            subject: "📢 New Leave Application: {{user_name}}",
            body: wrap(`
                <h2 style="margin-top: 0; color: ${PRIMARY_COLOR};">New Leave Request,</h2>
                <p><strong>{{user_name}}</strong> has submitted a new leave application.</p>
                <div style="background-color: #f0f9ff; border-left: 4px solid ${ACCENT_COLOR}; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Type:</strong> {{leave_type}}</p>
                    <p style="margin: 5px 0;"><strong>From:</strong> {{start_date}}</p>
                    <p style="margin: 5px 0;"><strong>To:</strong> {{end_date}}</p>
                    <p style="margin: 5px 0;"><strong>Reason:</strong><br/>{{reason}}</p>
                </div>
                <p style="font-size: 14px; color: ${MUTED_TEXT}; margin-top: 20px;">Please login to the admin panel to approve or reject this request.</p>
            `),
            variables_hint: "user_name, leave_type, start_date, end_date, reason",
            cc_manager: false
        },
        {
            slug: "leave_approved",
            name: "Leave Approved",
            subject: "✅ Leave Approved",
            body: wrap(`
                <h2 style="margin-top: 0; color: #16a34a;">Leave Approved</h2>
                <p>Dear <strong>{{user_name}}</strong>,</p>
                <p>We are pleased to inform you that your leave application has been <strong>approved</strong>.</p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Type:</strong> {{leave_type}}</p>
                    <p style="margin: 5px 0;"><strong>Dates:</strong> {{start_date}} to {{end_date}}</p>
                </div>
                <p>Enjoy your time off!</p>
            `),
            variables_hint: "user_name, leave_type, start_date, end_date",
            cc_manager: true
        },
        {
            slug: "leave_rejected",
            name: "Leave Rejected",
            subject: "❌ Leave Rejected",
            body: wrap(`
                <h2 style="margin-top: 0; color: #dc2626;">Leave Application Rejected</h2>
                <p>Dear <strong>{{user_name}}</strong>,</p>
                <p>We regret to inform you that your leave application has been <strong>rejected</strong>.</p>
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Type:</strong> {{leave_type}}</p>
                    <p style="margin: 5px 0;"><strong>Dates:</strong> {{start_date}} to {{end_date}}</p>
                    <p style="margin: 15px 0 5px; color: #991b1b;"><strong>Reason for Rejection:</strong></p>
                    <p style="margin: 0; font-style: italic;">{{rejection_reason}}</p>
                </div>
                <p>If you have any questions, please contact your manager.</p>
            `),
            variables_hint: "user_name, leave_type, start_date, end_date, rejection_reason",
            cc_manager: true
        },
        {
            slug: "onduty_applied",
            name: "On-Duty Applied",
            subject: "📢 New On-Duty Application: {{user_name}}",
            body: wrap(`
                <h2 style="margin-top: 0; color: ${PRIMARY_COLOR};">New On-Duty Request</h2>
                <p><strong>{{user_name}}</strong> has submitted a new on-duty application.</p>
                <div style="background-color: #eff6ff; border-left: 4px solid ${ACCENT_COLOR}; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Period:</strong> {{start_date}} - {{end_date}}</p>
                    <p style="margin: 5px 0;"><strong>Reason:</strong><br/>{{reason}}</p>
                </div>
                <p style="font-size: 14px; color: ${MUTED_TEXT}; margin-top: 20px;">Please login to the admin panel to approve or reject this request.</p>
            `),
            variables_hint: "user_name, start_date, end_date, reason",
            cc_manager: false
        },
        {
            slug: "onduty_approved",
            name: "On-Duty Approved",
            subject: "✅ On-Duty Approved",
            body: wrap(`
                <h2 style="margin-top: 0; color: #16a34a;">On-Duty Application Approved</h2>
                <p>Dear <strong>{{user_name}}</strong>,</p>
                <p>Your On-Duty application has been <strong>approved</strong>.</p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Dates:</strong> {{start_date}} to {{end_date}}</p>
                </div>
            `),
            variables_hint: "user_name, start_date, end_date",
            cc_manager: true
        },
        {
            slug: "onduty_rejected",
            name: "On-Duty Rejected",
            subject: "❌ On-Duty Rejected",
            body: wrap(`
                <h2 style="margin-top: 0; color: #dc2626;">On-Duty Application Rejected</h2>
                <p>Dear <strong>{{user_name}}</strong>,</p>
                <p>Your On-Duty application has been <strong>rejected</strong>.</p>
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Dates:</strong> {{start_date}} to {{end_date}}</p>
                    <p style="margin: 15px 0 5px; color: #991b1b;"><strong>Reason for Rejection:</strong></p>
                    <p style="margin: 0; font-style: italic;">{{rejection_reason}}</p>
                </div>
            `),
            variables_hint: "user_name, start_date, end_date, rejection_reason",
            cc_manager: true
        },
        {
            slug: "leave_applied_confirmation",
            name: "Leave Application Confirmation",
            subject: "📋 Leave Applied: {{leave_type}}",
            body: wrap(`
                <h2 style="margin-top: 0; color: ${PRIMARY_COLOR};">Application Received</h2>
                <p>Dear <strong>{{user_name}}</strong>,</p>
                <p>This is a confirmation that your leave application has been submitted successfully.</p>
                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Type:</strong> {{leave_type}}</p>
                    <p style="margin: 5px 0;"><strong>Dates:</strong> {{start_date}} to {{end_date}}</p>
                    <p style="margin: 5px 0;"><strong>Reason:</strong> {{reason}}</p>
                </div>
                <p style="color: ${MUTED_TEXT};">You will be notified via email once your manager reviews your request.</p>
            `),
            variables_hint: "user_name, leave_type, start_date, end_date, reason",
            cc_manager: true
        },
        {
            slug: "onduty_applied_confirmation",
            name: "On-Duty Application Confirmation",
            subject: "📋 On-Duty Application Submitted",
            body: wrap(`
                <h2 style="margin-top: 0; color: ${PRIMARY_COLOR};">Application Received</h2>
                <p>Dear <strong>{{user_name}}</strong>,</p>
                <p>This is a confirmation that your On-Duty application has been submitted successfully.</p>
                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Client:</strong> {{client_name}}</p>
                    <p style="margin: 5px 0;"><strong>Dates:</strong> {{start_date}} to {{end_date}}</p>
                    <p style="margin: 5px 0;"><strong>Purpose:</strong> {{reason}}</p>
                </div>
                <p style="color: ${MUTED_TEXT};">You will be notified via email once your manager reviews your request.</p>
            `),
            variables_hint: "user_name, start_date, end_date, client_name, reason",
            cc_manager: true
        }
    ];

    for (const t of templates) {
        const [template, created] = await EmailTemplate.findOrCreate({
            where: { slug: t.slug },
            defaults: t
        });

        if (!created) {
            await template.update(t);
            console.log(`Updated template: ${t.slug}`);
        } else {
            console.log(`Created template: ${t.slug}`);
        }
    }
}

module.exports = seedTemplates;

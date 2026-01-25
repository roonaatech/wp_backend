const db = require("../models");
const EmailTemplate = db.email_templates;

async function seedTemplates() {
    const templates = [
        {
            slug: "leave_applied",
            name: "Leave Applied",
            subject: "New Leave Application: {{user_name}}",
            body: "<p>Dear Admin/Manager,</p><p>{{user_name}} has applied for {{leave_type}} from {{start_date}} to {{end_date}}.</p><p>Reason: {{reason}}</p><p>Please login to approve or reject.</p>",
            variables_hint: "user_name, leave_type, start_date, end_date, reason"
        },
        {
            slug: "leave_approved",
            name: "Leave Approved",
            subject: "Leave Approved",
            body: "<p>Dear {{user_name}},</p><p>Your leave application for {{leave_type}} from {{start_date}} to {{end_date}} has been APPROVED.</p>",
            variables_hint: "user_name, leave_type, start_date, end_date"
        },
        {
            slug: "leave_rejected",
            name: "Leave Rejected",
            subject: "Leave Rejected",
            body: "<p>Dear {{user_name}},</p><p>Your leave application for {{leave_type}} from {{start_date}} to {{end_date}} has been REJECTED.</p><p>Reason: {{rejection_reason}}</p>",
            variables_hint: "user_name, leave_type, start_date, end_date, rejection_reason"
        },
        {
            slug: "onduty_applied",
            name: "On-Duty Applied",
            subject: "New On-Duty Application: {{user_name}}",
            body: "<p>Dear Admin/Manager,</p><p>{{user_name}} has applied for On-Duty from {{start_date}} to {{end_date}}.</p><p>Reason: {{reason}}</p><p>Please login to approve or reject.</p>",
            variables_hint: "user_name, start_date, end_date, reason"
        },
        {
            slug: "onduty_approved",
            name: "On-Duty Approved",
            subject: "On-Duty Approved",
            body: "<p>Dear {{user_name}},</p><p>Your On-Duty application from {{start_date}} to {{end_date}} has been APPROVED.</p>",
            variables_hint: "user_name, start_date, end_date"
        },
        {
            slug: "onduty_rejected",
            name: "On-Duty Rejected",
            subject: "On-Duty Rejected",
            body: "<p>Dear {{user_name}},</p><p>Your On-Duty application from {{start_date}} to {{end_date}} has been REJECTED.</p><p>Reason: {{rejection_reason}}</p>",
            variables_hint: "user_name, start_date, end_date, rejection_reason"
        },
        {
            slug: "leave_applied_confirmation",
            name: "Leave Application Confirmation",
            subject: "Leave Applied: {{leave_type}}",
            body: "<p>Dear {{user_name}},</p><p>You have successfully applied for {{leave_type}} from {{start_date}} to {{end_date}}.</p><p>Reason: {{reason}}</p><p>You will be notified once it is approved.</p>",
            variables_hint: "user_name, leave_type, start_date, end_date, reason"
        },
        {
            slug: "onduty_applied_confirmation",
            name: "On-Duty Application Confirmation",
            subject: "On-Duty Application Submitted",
            body: "<p>Dear {{user_name}},</p><p>You have successfully submitted an On-Duty application from {{start_date}} to {{end_date}}.</p><p>Client: {{client_name}}</p><p>Reason: {{reason}}</p><p>You will be notified once it is approved.</p>",
            variables_hint: "user_name, start_date, end_date, client_name, reason"
        }
    ];

    for (const t of templates) {
        const exists = await EmailTemplate.findOne({ where: { slug: t.slug } });
        if (!exists) {
            await EmailTemplate.create(t);
            console.log(`Created template: ${t.slug}`);
        } else {
            console.log(`Template already exists: ${t.slug}`);
        }
    }
}

module.exports = seedTemplates;

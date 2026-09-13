const db = require("../models");

const EmailTemplate = db.email_templates;

const ANNIVERSARY_WISH_SLUG = "work_anniversary";

// Professional teal/emerald/blue palette for work anniversary
const VIOLET = "#7c3aed";
const PINK = "#ec4899";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const BLUE = "#3b82f6";
const INK = "#1e1b4b";

/**
 * Pre-styled "Celebrating N years of service today!" pill.
 * Returned blank when the years of service is 0 or unknown.
 */
const buildYearsBadge = (years) => {
    if (!years) return '';
    return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 22px;">
            <tr>
                <td style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 999px; padding: 9px 22px; color: #047857; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold;">
                    🌟 Celebrating ${years} year${years > 1 ? 's' : ''} of service today!
                </td>
            </tr>
        </table>`;
};

// Email-safe markup: tables for layout, inline styles only, solid background
const anniversaryWishBody = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0fdf4; padding: 24px 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <tr>
        <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(4, 120, 87, 0.12);">

                <tr>
                    <td align="center" style="background-color: ${EMERALD}; background-image: linear-gradient(135deg, ${BLUE} 0%, ${EMERALD} 100%); padding: 38px 24px 34px;">
                        <div style="font-size: 22px; letter-spacing: 8px; line-height: 1;">&#10024; &#127881; &#127775; &#127882; &#128079;</div>
                        <div style="font-size: 66px; line-height: 1; margin: 16px 0 10px;">&#127882;</div>
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;">Work Anniversary</h1>
                        <p style="margin: 10px 0 0; color: #ffffff; font-size: 23px; font-weight: bold;">{{first_name}}!</p>
                    </td>
                </tr>

                <tr>
                    <td style="font-size: 0; line-height: 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="20%" height="7" style="background-color: ${BLUE}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${EMERALD}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${AMBER}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${PINK}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${VIOLET}; font-size: 0; line-height: 0;">&nbsp;</td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding: 30px 34px 8px;">
                        {{years_badge}}
                        <p style="margin: 0 0 14px; color: #1f2937; font-size: 15px; line-height: 1.7;">
                            Dear <strong>{{employee_name}}</strong>,
                        </p>
                        <p style="margin: 0 0 18px; color: #1f2937; font-size: 15px; line-height: 1.7;">
                            Congratulations on reaching another career milestone with us! 
                            Thank you for your commitment, hard work, and the positive energy you bring to the team every day. 
                            We are incredibly grateful to have you with us, and we look forward to achieving many more milestones together.
                        </p>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px;">
                            <tr>
                                <td style="background-color: #f0fdf4; border-left: 5px solid ${EMERALD}; border-radius: 8px; padding: 16px 20px; color: #065f46; font-size: 15px; font-style: italic; line-height: 1.6;">
                                    &#127775; May the coming year bring you continued growth, success, and many reasons to take pride in your work.
                                </td>
                            </tr>
                        </table>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 22px;">
                            <tr>
                                <td align="center" width="33%" style="background-color: #ecfdf5; border-radius: 10px; padding: 14px 8px;">
                                    <div style="font-size: 26px; line-height: 1;">&#127775;</div>
                                    <div style="color: ${EMERALD}; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding-top: 6px;">Dedicated</div>
                                </td>
                                <td width="12">&nbsp;</td>
                                <td align="center" width="33%" style="background-color: #eff6ff; border-radius: 10px; padding: 14px 8px;">
                                    <div style="font-size: 26px; line-height: 1;">&#10024;</div>
                                    <div style="color: ${BLUE}; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding-top: 6px;">Inspire</div>
                                </td>
                                <td width="12">&nbsp;</td>
                                <td align="center" width="33%" style="background-color: #fffbeb; border-radius: 10px; padding: 14px 8px;">
                                    <div style="font-size: 26px; line-height: 1;">&#128200;</div>
                                    <div style="color: #b45309; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding-top: 6px;">Grow</div>
                                </td>
                            </tr>
                        </table>

                        <p style="margin: 0 0 6px; color: #1f2937; font-size: 15px; line-height: 1.7;">
                            Warm wishes,<br />
                            <strong style="color: ${INK};">Human Resources</strong>
                        </p>
                    </td>
                </tr>

                <tr>
                    <td align="center" style="padding: 18px 24px 26px;">
                        <div style="font-size: 20px; letter-spacing: 6px;">&#127882; &#10024; &#127881; &#128079;</div>
                    </td>
                </tr>

                <tr>
                    <td align="center" style="background-color: ${INK}; padding: 18px 24px;">
                        <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: bold; letter-spacing: 1px;">WorkPulse</p>
                        <p style="margin: 6px 0 0; color: #a5b4fc; font-size: 11px;">{{anniversary_date}}</p>
                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>
`;

const ANNIVERSARY_TEMPLATES = [
    {
        slug: ANNIVERSARY_WISH_SLUG,
        name: "Work Anniversary Wish",
        subject: "\u{1F389} Happy Work Anniversary, {{first_name}}! \u{1F7E2}",
        body: anniversaryWishBody,
        variables_hint: "employee_name,first_name,anniversary_date,years_badge,years_of_service",
        is_active: true,
        cc_manager: false
    }
];

/**
 * Create the work anniversary templates when they are missing.
 */
async function seedAnniversaryTemplates(options = {}) {
    const { force = false } = options;

    for (const t of ANNIVERSARY_TEMPLATES) {
        const [template, created] = await EmailTemplate.findOrCreate({
            where: { slug: t.slug },
            defaults: t
        });

        if (created) {
            console.log(`Created email template: ${t.slug}`);
        } else if (force) {
            await template.update(t);
            console.log(`Reset email template to the default design: ${t.slug}`);
        } else {
            console.log(`Email template already exists, skipping update: ${t.slug}`);
        }
    }
}

module.exports = seedAnniversaryTemplates;
module.exports.ANNIVERSARY_WISH_SLUG = ANNIVERSARY_WISH_SLUG;
module.exports.buildYearsBadge = buildYearsBadge;

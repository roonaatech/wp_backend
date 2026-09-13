const db = require("../models");

const EmailTemplate = db.email_templates;

const BIRTHDAY_WISH_SLUG = "birthday_wish";

// Festive palette — deliberately brighter than the standard transactional
// layout in email_layout.js, which stays reserved for approval/reminder mail.
const VIOLET = "#7c3aed";
const PINK = "#ec4899";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const BLUE = "#3b82f6";
const INK = "#1e1b4b";

/**
 * Pre-styled "Turning N today!" pill.
 * Returned blank when the age is unknown so the layout never shows a stub.
 */
const buildAgeBadge = (age) => {
    if (!age) return '';
    return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 22px;">
            <tr>
                <td style="background-color: #fef3c7; border: 2px solid #fcd34d; border-radius: 999px; padding: 9px 22px; color: #92400e; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold;">
                    &#127880; Turning ${age} today!
                </td>
            </tr>
        </table>`;
};

// Email-safe markup: tables for layout, inline styles only, solid background
// colours declared before gradients so Outlook still renders the header.
const birthdayWishBody = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f3ff; padding: 24px 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <tr>
        <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(76, 29, 149, 0.12);">

                <tr>
                    <td align="center" style="background-color: ${PINK}; background-image: linear-gradient(135deg, ${VIOLET} 0%, ${PINK} 55%, ${AMBER} 100%); padding: 38px 24px 34px;">
                        <div style="font-size: 22px; letter-spacing: 8px; line-height: 1;">&#127882; &#127880; &#127881; &#127873; &#10024;</div>
                        <div style="font-size: 66px; line-height: 1; margin: 16px 0 10px;">&#127874;</div>
                        <h1 style="margin: 0; color: #ffffff; font-size: 30px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;">Happy Birthday</h1>
                        <p style="margin: 10px 0 0; color: #ffffff; font-size: 23px; font-weight: bold;">{{first_name}}!</p>
                    </td>
                </tr>

                <tr>
                    <td style="font-size: 0; line-height: 0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="20%" height="7" style="background-color: ${VIOLET}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${PINK}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${AMBER}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${EMERALD}; font-size: 0; line-height: 0;">&nbsp;</td>
                                <td width="20%" height="7" style="background-color: ${BLUE}; font-size: 0; line-height: 0;">&nbsp;</td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr>
                    <td style="padding: 30px 34px 8px;">
                        {{age_badge}}
                        <p style="margin: 0 0 14px; color: #1f2937; font-size: 15px; line-height: 1.7;">
                            Dear <strong>{{employee_name}}</strong>,
                        </p>
                        <p style="margin: 0 0 18px; color: #1f2937; font-size: 15px; line-height: 1.7;">
                            Wishing you a day filled with joy, laughter and everything you love!
                            Thank you for everything you bring to the team &mdash; we are so glad
                            to have you with us.
                        </p>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px;">
                            <tr>
                                <td style="background-color: #fdf2f8; border-left: 5px solid ${PINK}; border-radius: 8px; padding: 16px 20px; color: #9d174d; font-size: 15px; font-style: italic; line-height: 1.6;">
                                    &#127775; May this year bring you new adventures, great health and
                                    plenty of reasons to smile.
                                </td>
                            </tr>
                        </table>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 22px;">
                            <tr>
                                <td align="center" width="33%" style="background-color: #f5f3ff; border-radius: 10px; padding: 14px 8px;">
                                    <div style="font-size: 26px; line-height: 1;">&#127881;</div>
                                    <div style="color: ${VIOLET}; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding-top: 6px;">Celebrate</div>
                                </td>
                                <td width="12">&nbsp;</td>
                                <td align="center" width="33%" style="background-color: #fff7ed; border-radius: 10px; padding: 14px 8px;">
                                    <div style="font-size: 26px; line-height: 1;">&#127856;</div>
                                    <div style="color: #c2410c; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding-top: 6px;">Enjoy</div>
                                </td>
                                <td width="12">&nbsp;</td>
                                <td align="center" width="33%" style="background-color: #ecfdf5; border-radius: 10px; padding: 14px 8px;">
                                    <div style="font-size: 26px; line-height: 1;">&#127873;</div>
                                    <div style="color: #047857; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding-top: 6px;">Unwind</div>
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
                        <div style="font-size: 20px; letter-spacing: 6px;">&#127880; &#127874; &#127873; &#127882;</div>
                    </td>
                </tr>

                <tr>
                    <td align="center" style="background-color: ${INK}; padding: 18px 24px;">
                        <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: bold; letter-spacing: 1px;">WorkPulse</p>
                        <p style="margin: 6px 0 0; color: #a5b4fc; font-size: 11px;">{{birthday_date}}</p>
                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>
`;

const BIRTHDAY_TEMPLATES = [
    {
        slug: BIRTHDAY_WISH_SLUG,
        name: "Birthday Wish",
        subject: "\u{1F382} Happy Birthday, {{first_name}}! \u{1F389}",
        body: birthdayWishBody,
        variables_hint: "employee_name,first_name,birthday_date,turning_age,age_badge",
        is_active: true,
        cc_manager: false
    }
];

/**
 * Create the birthday templates when they are missing.
 *
 * Existing rows are never overwritten so production customisations made through
 * the Email Settings screen are preserved — the same policy the other seeders use.
 * Pass { force: true } to deliberately reset a template back to this design.
 */
async function seedBirthdayTemplates(options = {}) {
    const { force = false } = options;

    for (const t of BIRTHDAY_TEMPLATES) {
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

module.exports = seedBirthdayTemplates;
module.exports.BIRTHDAY_WISH_SLUG = BIRTHDAY_WISH_SLUG;
module.exports.buildAgeBadge = buildAgeBadge;

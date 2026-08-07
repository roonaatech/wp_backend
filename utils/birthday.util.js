const db = require("../models");
const { Op } = require("sequelize");
const emailService = require("./email.service");
const { BIRTHDAY_WISH_SLUG, buildAgeBadge } = require("./seed_birthday_template");

const Staff = db.user;
const Role = db.roles;
const EmployeeProfile = db.employee_profiles;
const BirthdayWishLog = db.birthday_wish_logs;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Break "now" into calendar parts for the given timezone, so the birthday
 * list flips over at midnight in the app timezone and not on the server's.
 */
const getTodayParts = (tz) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

    return {
        year: parseInt(parts.year, 10),
        month: parseInt(parts.month, 10),
        day: parseInt(parts.day, 10)
    };
};

const getTodayDateString = (tz) => {
    const { year, month, day } = getTodayParts(tz);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** Today rendered for humans in the given timezone, e.g. "07 Aug 2026". */
const getTodayLongLabel = (tz) => {
    const { year, month, day } = getTodayParts(tz);
    return `${String(day).padStart(2, '0')} ${MONTH_NAMES[month - 1]} ${year}`;
};

/** Format a YYYY-MM-DD date of birth as "07 Aug" (year intentionally omitted). */
const formatDayMonth = (dateOnlyStr) => {
    if (!dateOnlyStr) return '';
    const [, month, day] = String(dateOnlyStr).split('T')[0].split('-');
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1] || '';
    return `${day} ${monthName}`.trim();
};

const monthDayMatch = (month, day) => ({
    [Op.and]: [
        db.sequelize.where(db.sequelize.fn('MONTH', db.sequelize.col('profile_info.date_of_birth')), month),
        db.sequelize.where(db.sequelize.fn('DAY', db.sequelize.col('profile_info.date_of_birth')), day)
    ]
});

/**
 * Fetch every active staff member whose date of birth falls on today's
 * day/month in the given timezone.
 */
const getTodaysBirthdays = async (tz) => {
    const { year, month, day } = getTodayParts(tz);

    const dateMatchers = [monthDayMatch(month, day)];
    // 29-Feb birthdays are observed on 28-Feb in non-leap years.
    if (month === 2 && day === 28 && !isLeapYear(year)) {
        dateMatchers.push(monthDayMatch(2, 29));
    }

    const users = await Staff.findAll({
        where: {
            active: 1,
            [Op.or]: dateMatchers
        },
        attributes: ['staffid', 'firstname', 'lastname', 'email', 'secondary_email', 'gender'],
        include: [
            {
                model: EmployeeProfile,
                as: 'profile_info',
                required: true,
                attributes: ['date_of_birth', 'image_path']
            },
            {
                model: Role,
                as: 'role_info',
                required: false,
                attributes: ['id', 'name', 'display_name']
            }
        ],
        order: [['firstname', 'ASC'], ['lastname', 'ASC']]
    });

    const people = users.map((u) => {
        const dob = u.profile_info?.date_of_birth
            ? String(u.profile_info.date_of_birth).split('T')[0]
            : null;
        const birthYear = dob ? parseInt(dob.substring(0, 4), 10) : null;

        return {
            staff_id: u.staffid,
            name: `${u.firstname} ${u.lastname}`.trim(),
            email: u.email,
            secondary_email: u.secondary_email || null,
            gender: u.gender,
            date_of_birth: dob,
            day_month: formatDayMonth(dob),
            turning_age: birthYear ? year - birthYear : null,
            image_path: u.profile_info?.image_path || null,
            role_name: u.role_info?.display_name || u.role_info?.name || null
        };
    });

    return await attachWishStatus(people, getTodayDateString(tz));
};

/** Every address a birthday wish should go to: official first, then personal. */
const getWishRecipients = (person) => {
    const addresses = [person.email, person.secondary_email]
        .map(e => (e || '').trim())
        .filter(Boolean);

    // De-duplicate case-insensitively in case both columns hold the same address
    const seen = new Set();
    return addresses.filter((e) => {
        const key = e.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/** Decorate each person with whether their wish already went out on `dateStr`. */
const attachWishStatus = async (people, dateStr) => {
    if (people.length === 0) return people;

    const logs = await BirthdayWishLog.findAll({
        where: {
            wish_date: dateStr,
            staff_id: { [Op.in]: people.map(p => p.staff_id) }
        }
    });

    const byStaffId = new Map(logs.map(l => [l.staff_id, l]));

    return people.map((person) => {
        const log = byStaffId.get(person.staff_id);
        return {
            ...person,
            wish_status: log ? log.status : 'Pending',
            wish_sent: !!log && log.status === 'Sent',
            wish_sent_at: log && log.status === 'Sent' ? log.createdAt : null,
            wish_sent_to: log ? log.sent_to : null,
            wish_source: log ? log.source : null,
            wish_error: log ? log.error_message : null,
            wish_recipients: getWishRecipients(person)
        };
    });
};

/**
 * Send one birthday wish to both the official and personal address and record
 * the outcome. Already-sent wishes are skipped so the scheduled job and the
 * dashboard button can never double-send on the same day.
 */
const sendBirthdayWish = async (person, { dateStr, dateLabel, source = 'cron', triggeredBy = null }) => {
    const recipients = getWishRecipients(person);

    if (recipients.length === 0) {
        return { staff_id: person.staff_id, name: person.name, outcome: 'no_email' };
    }

    const existing = await BirthdayWishLog.findOne({
        where: { staff_id: person.staff_id, wish_date: dateStr }
    });

    if (existing && existing.status === 'Sent') {
        return { staff_id: person.staff_id, name: person.name, outcome: 'already_sent' };
    }

    const result = await emailService.sendTemplateEmail(recipients.join(','), BIRTHDAY_WISH_SLUG, {
        employee_name: person.name,
        first_name: person.name.split(' ')[0],
        birthday_date: dateLabel,
        turning_age: person.turning_age ? String(person.turning_age) : '',
        age_badge: buildAgeBadge(person.turning_age)
    });

    const payload = {
        staff_id: person.staff_id,
        wish_date: dateStr,
        sent_to: recipients.join(','),
        source,
        triggered_by: triggeredBy,
        status: result.success ? 'Sent' : 'Failed',
        error_message: result.success ? null : (result.message || result.error || 'Unknown error')
    };

    try {
        if (existing) {
            await existing.update(payload);
        } else {
            await BirthdayWishLog.create(payload);
        }
    } catch (err) {
        // A concurrent send won the unique (staff_id, wish_date) index
        if (err.name === 'SequelizeUniqueConstraintError') {
            return { staff_id: person.staff_id, name: person.name, outcome: 'already_sent' };
        }
        throw err;
    }

    return {
        staff_id: person.staff_id,
        name: person.name,
        outcome: result.success ? 'sent' : 'failed',
        recipients,
        error: result.success ? null : (result.message || result.error)
    };
};

const DIGEST_ROLES_SETTING_KEY = 'birthday_digest_recipient_roles';

/** Active staff holding any of the given role ids, with a usable email. */
const getStaffByRoleIds = async (roleIds) => {
    if (!roleIds || roleIds.length === 0) return [];

    return await Staff.findAll({
        where: {
            active: 1,
            role: { [Op.in]: roleIds },
            email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        },
        attributes: ['staffid', 'firstname', 'lastname', 'email', 'secondary_email'],
        order: [['firstname', 'ASC'], ['lastname', 'ASC']]
    });
};

/** Role ids holding the can_view_birthdays permission. */
const getBirthdayPermittedRoleIds = async () => {
    const roles = await Role.findAll({
        where: { can_view_birthdays: true, active: true },
        attributes: ['id']
    });
    return roles.map(r => r.id);
};

/**
 * Active staff in roles that carry the can_view_birthdays permission.
 * Used as the fallback when no digest roles have been configured.
 */
const getBirthdayPermittedStaff = async () => {
    return await getStaffByRoleIds(await getBirthdayPermittedRoleIds());
};

/**
 * Role ids configured to receive the birthday digest, from the
 * `birthday_digest_recipient_roles` setting (comma separated ids).
 * Returns null when unset so callers can fall back to HR and above.
 */
const getConfiguredDigestRoleIds = async () => {
    try {
        const setting = await db.settings.findOne({ where: { key: DIGEST_ROLES_SETTING_KEY } });
        const raw = setting && setting.value ? String(setting.value).trim() : '';
        if (!raw) return null;

        const ids = raw
            .split(',')
            .map(part => parseInt(part.trim(), 10))
            .filter(Number.isInteger);

        return ids.length > 0 ? [...new Set(ids)] : null;
    } catch (err) {
        console.error('Error reading birthday digest recipient roles:', err);
        return null;
    }
};

/**
 * Staff who should receive the birthday digest.
 *
 * The roles picked in System Settings > Notification Configuration are the
 * source of truth. When that setting is blank the digest falls back to every
 * role holding the can_view_birthdays permission.
 */
const getBirthdayDigestRecipients = async () => {
    const configured = await getConfiguredDigestRoleIds();

    if (!configured) {
        console.log('[BIRTHDAY] No digest roles configured — defaulting to roles with the birthday permission.');
        return await getBirthdayPermittedStaff();
    }

    return await getStaffByRoleIds(configured);
};

/** Build the HTML digest emailed to HR and above. */
const buildBirthdayEmailBody = (birthdays, recipient, todayLabel) => {
    const rows = birthdays.map((b) => `
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">
                ${b.name}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                ${b.role_name || '-'}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                ${b.day_month}${b.turning_age ? ` (turning ${b.turning_age})` : ''}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                ${b.email || '-'}
            </td>
        </tr>
    `).join('');

    const heading = birthdays.length === 1
        ? '1 staff member is celebrating a birthday today'
        : `${birthdays.length} staff members are celebrating birthdays today`;

    return `
        <p>Dear ${recipient.firstname},</p>
        <p>🎂 <strong>${heading}</strong> (${todayLabel}).</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 640px; font-family: Helvetica, Arial, sans-serif; font-size: 14px;">
            <thead>
                <tr style="background-color: #1e1b4b; color: #ffffff;">
                    <th style="padding: 10px 12px; text-align: left;">Name</th>
                    <th style="padding: 10px 12px; text-align: left;">Role</th>
                    <th style="padding: 10px 12px; text-align: left;">Birthday</th>
                    <th style="padding: 10px 12px; text-align: left;">Email</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        <p style="margin-top: 20px;">Please plan the wishes and celebrations accordingly.</p>
        <p style="color: #6b7280; font-size: 12px;">This is an automated message from WorkPulse.</p>
    `;
};

module.exports = {
    getTodayParts,
    getTodayDateString,
    getTodayLongLabel,
    formatDayMonth,
    getTodaysBirthdays,
    getBirthdayPermittedStaff,
    getBirthdayPermittedRoleIds,
    getConfiguredDigestRoleIds,
    getBirthdayDigestRecipients,
    getWishRecipients,
    DIGEST_ROLES_SETTING_KEY,
    attachWishStatus,
    sendBirthdayWish,
    buildBirthdayEmailBody
};

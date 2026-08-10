const db = require("../models");
const { Op } = require("sequelize");
const emailService = require("./email.service");
const { ANNIVERSARY_WISH_SLUG, buildYearsBadge } = require("./seed_anniversary_template");

const Staff = db.user;
const Role = db.roles;
const EmployeeProfile = db.employee_profiles;
const AnniversaryWishLog = db.anniversary_wish_logs;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Break "now" into calendar parts for the given timezone, so the work anniversary
 * list flips over at midnight in the app timezone.
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

/** Format a YYYY-MM-DD joining date as "07 Aug". */
const formatDayMonth = (dateOnlyStr) => {
    if (!dateOnlyStr) return '';
    const [, month, day] = String(dateOnlyStr).split('T')[0].split('-');
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1] || '';
    return `${day} ${monthName}`.trim();
};

const monthDayMatch = (month, day) => ({
    [Op.and]: [
        db.sequelize.where(db.sequelize.fn('MONTH', db.sequelize.col('profile_info.date_of_joining')), month),
        db.sequelize.where(db.sequelize.fn('DAY', db.sequelize.col('profile_info.date_of_joining')), day)
    ]
});

/**
 * Fetch every active staff member whose date of joining falls on today's
 * day/month in the given timezone.
 */
const getTodaysAnniversaries = async (tz) => {
    const { year, month, day } = getTodayParts(tz);

    const dateMatchers = [monthDayMatch(month, day)];
    // 29-Feb anniversaries are observed on 28-Feb in non-leap years.
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
                attributes: ['date_of_joining', 'image_path']
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
        const doj = u.profile_info?.date_of_joining
            ? String(u.profile_info.date_of_joining).split('T')[0]
            : null;
        const joiningYear = doj ? parseInt(doj.substring(0, 4), 10) : null;
        const yearsOfService = joiningYear ? year - joiningYear : null;

        return {
            staff_id: u.staffid,
            name: `${u.firstname} ${u.lastname}`.trim(),
            email: u.email,
            secondary_email: u.secondary_email || null,
            gender: u.gender,
            date_of_joining: doj,
            day_month: formatDayMonth(doj),
            years_of_service: yearsOfService,
            image_path: u.profile_info?.image_path || null,
            role_name: u.role_info?.display_name || u.role_info?.name || null
        };
    });

    // Only celebrate complete years of service (years > 0, filtering out joining day)
    const activeAnniversaries = people.filter(p => p.years_of_service > 0);

    return await attachWishStatus(activeAnniversaries, getTodayDateString(tz));
};

/** Every address an anniversary wish should go to: official first, then personal. */
const getWishRecipients = (person) => {
    const addresses = [person.email, person.secondary_email]
        .map(e => (e || '').trim())
        .filter(Boolean);

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

    const logs = await AnniversaryWishLog.findAll({
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
 * Send one work anniversary wish to both the official and personal address.
 */
const sendAnniversaryWish = async (person, { dateStr, dateLabel, source = 'cron', triggeredBy = null }) => {
    const recipients = getWishRecipients(person);

    if (recipients.length === 0) {
        return { staff_id: person.staff_id, name: person.name, outcome: 'no_email' };
    }

    const existing = await AnniversaryWishLog.findOne({
        where: { staff_id: person.staff_id, wish_date: dateStr }
    });

    if (existing && existing.status === 'Sent') {
        return { staff_id: person.staff_id, name: person.name, outcome: 'already_sent' };
    }

    const result = await emailService.sendTemplateEmail(recipients.join(','), ANNIVERSARY_WISH_SLUG, {
        employee_name: person.name,
        first_name: person.name.split(' ')[0],
        anniversary_date: dateLabel,
        years_of_service: person.years_of_service ? String(person.years_of_service) : '',
        years_badge: buildYearsBadge(person.years_of_service)
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
            await AnniversaryWishLog.create(payload);
        }
    } catch (err) {
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

const DIGEST_ROLES_SETTING_KEY = 'anniversary_digest_recipient_roles';

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

/** Role ids holding the can_view_anniversaries permission. */
const getAnniversaryPermittedRoleIds = async () => {
    const roles = await Role.findAll({
        where: { can_view_anniversaries: true, active: true },
        attributes: ['id']
    });
    return roles.map(r => r.id);
};

const getAnniversaryPermittedStaff = async () => {
    return await getStaffByRoleIds(await getAnniversaryPermittedRoleIds());
};

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
        console.error('Error reading anniversary digest recipient roles:', err);
        return null;
    }
};

const getAnniversaryDigestRecipients = async () => {
    const configured = await getConfiguredDigestRoleIds();

    if (!configured) {
        console.log('[ANNIVERSARY] No digest roles configured — defaulting to roles with the anniversary permission.');
        return await getAnniversaryPermittedStaff();
    }

    return await getStaffByRoleIds(configured);
};

/** Build the HTML digest emailed to HR and above. */
const buildAnniversaryEmailBody = (anniversaries, recipient, todayLabel) => {
    const rows = anniversaries.map((a) => `
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">
                ${a.name}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                ${a.role_name || '-'}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                Celebrating ${a.years_of_service} year${a.years_of_service > 1 ? 's' : ''}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">
                ${a.email || '-'}
            </td>
        </tr>
    `).join('');

    const heading = anniversaries.length === 1
        ? '1 staff member is celebrating a work anniversary today'
        : `${anniversaries.length} staff members are celebrating work anniversaries today`;

    return `
        <p>Dear ${recipient.firstname},</p>
        <p>🌟 <strong>${heading}</strong> (${todayLabel}).</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 640px; font-family: Helvetica, Arial, sans-serif; font-size: 14px;">
            <thead>
                <tr style="background-color: #10b981; color: #ffffff;">
                    <th style="padding: 10px 12px; text-align: left;">Name</th>
                    <th style="padding: 10px 12px; text-align: left;">Role</th>
                    <th style="padding: 10px 12px; text-align: left;">Anniversary</th>
                    <th style="padding: 10px 12px; text-align: left;">Email</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        <p style="margin-top: 20px;">Please congratulate them and plan any anniversary recognition accordingly.</p>
        <p style="color: #6b7280; font-size: 12px;">This is an automated message from WorkPulse.</p>
    `;
};

module.exports = {
    getTodayParts,
    getTodayDateString,
    getTodayLongLabel,
    formatDayMonth,
    getTodaysAnniversaries,
    getAnniversaryPermittedStaff,
    getAnniversaryPermittedRoleIds,
    getConfiguredDigestRoleIds,
    getAnniversaryDigestRecipients,
    getWishRecipients,
    DIGEST_ROLES_SETTING_KEY,
    attachWishStatus,
    sendAnniversaryWish,
    buildAnniversaryEmailBody
};

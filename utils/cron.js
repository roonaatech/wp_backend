const cron = require('node-cron');
const db = require('../models');
const emailService = require('./email.service');
const birthdayUtil = require('./birthday.util');
const anniversaryUtil = require('./anniversary.util');
const seedBirthdayTemplates = require('./seed_birthday_template');
const seedAnniversaryTemplates = require('./seed_anniversary_template');
const { getAppTimezone } = require('./hierarchy.util');
const { Op } = require('sequelize');

// Live task handles, kept so a schedule change can re-register them without
// restarting the process.
let reminderTask = null;
let birthdayTask = null;
let anniversaryTask = null;

const stopTask = (task) => {
    if (!task) return;
    try {
        if (typeof task.destroy === 'function') task.destroy();
        else task.stop();
    } catch (err) {
        console.error('[CRON] Failed to stop existing task:', err.message);
    }
};

const startPendingRequestReminderCron = async () => {
    const Setting = db.settings;
    try {
        stopTask(reminderTask);
        reminderTask = null;

        const scheduleSetting = await Setting.findOne({ where: { key: 'pending_request_reminder_schedule' } });
        const schedulePattern = scheduleSetting && scheduleSetting.value ? scheduleSetting.value : '0 8 * * *';
        const tz = await getAppTimezone();

        if (!cron.validate(schedulePattern)) {
            console.error(`[CRON] Invalid reminder cron expression "${schedulePattern}". Reminder job not scheduled.`);
            return;
        }

        console.log(`[CRON] Starting daily reminder cron job with schedule: ${schedulePattern} (timezone: ${tz})`);

        reminderTask = cron.schedule(schedulePattern, async () => {
        console.log('[CRON] Checking daily reminder configuration...');
        try {
            const Setting = db.settings;
            
            // Check if reminders are enabled
            const enableRemindersSetting = await Setting.findOne({ where: { key: 'enable_pending_request_reminders' } });
            const enableReminders = enableRemindersSetting ? enableRemindersSetting.value === 'true' : true;
            
            if (!enableReminders) {
                console.log('[CRON] Pending request reminders are disabled in settings. Skipping.');
                return;
            }

            // Get reminder days
            const reminderDaysSetting = await Setting.findOne({ where: { key: 'pending_request_reminder_days' } });
            const reminderDays = reminderDaysSetting ? parseInt(reminderDaysSetting.value) || 3 : 3;

            console.log(`[CRON] Running daily reminder for requests pending over ${reminderDays} days...`);

            const LeaveRequest = db.leave_requests;
            const TimeOffRequest = db.time_off_requests;
            const OnDutyLog = db.on_duty_logs;
            const Staff = db.user;

            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - reminderDays);

            // Fetch pending requests created before 3 days ago
            const pendingLeaves = await LeaveRequest.findAll({
                where: {
                    status: 'Pending',
                    createdAt: { [Op.lte]: targetDate }
                },
                include: [{ model: Staff, as: 'user' }]
            });

            const pendingTimeOff = await TimeOffRequest.findAll({
                where: {
                    status: 'Pending',
                    createdAt: { [Op.lte]: targetDate }
                },
                include: [{ model: Staff, as: 'user' }]
            });

            const pendingOnDuty = await OnDutyLog.findAll({
                where: {
                    status: 'Pending',
                    end_time: { [Op.ne]: null },
                    createdAt: { [Op.lte]: targetDate }
                },
                include: [{ model: Staff, as: 'user' }]
            });

            const allRequests = [
                ...pendingLeaves.map(r => ({ type: 'Leave', req: r })),
                ...pendingTimeOff.map(r => ({ type: 'Time Off', req: r })),
                ...pendingOnDuty.map(r => ({ type: 'On Duty', req: r }))
            ];

            for (const item of allRequests) {
                const { type, req } = item;
                const user = req.user;
                if (!user || !user.approving_manager_id) continue;

                const manager = await Staff.findByPk(user.approving_manager_id);
                if (!manager) continue;

                const grandManager = manager.approving_manager_id ? await Staff.findByPk(manager.approving_manager_id) : null;
                const ccEmail = grandManager && grandManager.email ? grandManager.email : null;

                if (manager.email) {
                    const subject = `Reminder: Pending ${type} request for ${user.firstname} ${user.lastname}`;
                    const body = `
                        <p>Dear ${manager.firstname},</p>
                        <p>This is a reminder that a <strong>${type}</strong> request from ${user.firstname} ${user.lastname} has been pending for over ${reminderDays} days.</p>
                        <p>Please log in to the WorkPulse system to approve or reject this request.</p>
                        <p>Request Details:</p>
                        <ul>
                            <li><strong>Type:</strong> ${type}</li>
                            <li><strong>Date Applied:</strong> ${new Date(req.createdAt).toLocaleDateString()}</li>
                        </ul>
                    `;

                    await emailService.sendEmail(manager.email, subject, body, ccEmail);
                }
            }
        } catch (error) {
            console.error('[CRON] Error running daily reminders:', error);
        }
        }, { timezone: tz });
    } catch (err) {
        console.error('Failed to start pending request reminder cron:', err);
    }
};

/**
 * One birthday run. On each celebrant's birthday it sends:
 *   1. a birthday wish to the celebrant, from the `birthday_wish` template
 *   2. a summary digest to Human Resource and higher hierarchy users
 *
 * Exported so it can be triggered manually or under test without waiting
 * for the schedule.
 */
const runBirthdayNotifications = async (tz) => {
    const Setting = db.settings;

    const enableSetting = await Setting.findOne({ where: { key: 'enable_birthday_notifications' } });
    const enabled = enableSetting ? enableSetting.value === 'true' : true;

    if (!enabled) {
        console.log('[CRON] Birthday notifications are disabled in settings. Skipping.');
        return { skipped: 'disabled', wishesSent: 0, digestsSent: 0 };
    }

    const todayLabel = birthdayUtil.getTodayLongLabel(tz);
    const todayDate = birthdayUtil.getTodayDateString(tz);
    const birthdays = await birthdayUtil.getTodaysBirthdays(tz);

    if (birthdays.length === 0) {
        console.log(`[CRON] No staff birthdays on ${todayLabel}. Skipping.`);
        return { skipped: 'no_birthdays', wishesSent: 0, digestsSent: 0 };
    }

    // 1. Wish each celebrant on both their official and personal address.
    //    Anyone already wished today (e.g. sent manually from the dashboard)
    //    is skipped by sendBirthdayWish.
    const wishSetting = await Setting.findOne({ where: { key: 'enable_birthday_wish_emails' } });
    const wishesEnabled = wishSetting ? wishSetting.value === 'true' : true;
    let wishesSent = 0;

    if (wishesEnabled) {
        for (const person of birthdays) {
            const outcome = await birthdayUtil.sendBirthdayWish(person, {
                dateStr: todayDate,
                dateLabel: todayLabel,
                source: 'cron'
            });

            if (outcome.outcome === 'sent') {
                wishesSent++;
            } else if (outcome.outcome === 'no_email') {
                console.warn(`[CRON] Skipping birthday wish for ${person.name} — no email on record.`);
            } else if (outcome.outcome === 'already_sent') {
                console.log(`[CRON] Birthday wish for ${person.name} already sent today. Skipping.`);
            } else {
                console.error(`[CRON] Birthday wish for ${person.name} failed: ${outcome.error}`);
            }
        }
        console.log(`[CRON] Sent ${wishesSent} birthday wish email(s).`);
    } else {
        console.log('[CRON] Birthday wish emails are disabled in settings. Sending digest only.');
    }

    // 2. Digest to the roles configured in Notification Configuration
    const recipients = await birthdayUtil.getBirthdayDigestRecipients();
    if (recipients.length === 0) {
        console.warn('[CRON] No users found in the configured birthday digest roles.');
        return { wishesSent, digestsSent: 0 };
    }

    const subject = birthdays.length === 1
        ? `🎂 Birthday Today: ${birthdays[0].name}`
        : `🎂 ${birthdays.length} Birthdays Today`;

    console.log(`[CRON] Sending birthday digest (${birthdays.length} birthday(s)) to ${recipients.length} recipient(s).`);

    let digestsSent = 0;
    for (const recipient of recipients) {
        const body = birthdayUtil.buildBirthdayEmailBody(birthdays, recipient, todayLabel);
        const result = await emailService.sendEmail(
            recipient.email,
            subject,
            body,
            recipient.secondary_email || null
        );
        if (result.success) digestsSent++;
    }

    return { wishesSent, digestsSent };
};

/**
 * Schedules the birthday job at 08:00 in the application timezone
 * (Asia/Kolkata / IST by default).
 */
const startBirthdayNotificationCron = async () => {
    try {
        const Setting = db.settings;

        stopTask(birthdayTask);
        birthdayTask = null;

        // Create the birthday templates if they are missing; never overwrites
        // an existing row, so edits made in Email Settings are preserved.
        await seedBirthdayTemplates();

        const scheduleSetting = await Setting.findOne({ where: { key: 'birthday_notification_schedule' } });
        const schedulePattern = scheduleSetting && scheduleSetting.value ? scheduleSetting.value : '0 8 * * *';
        const tz = await getAppTimezone();

        if (!cron.validate(schedulePattern)) {
            console.error(`[CRON] Invalid birthday cron expression "${schedulePattern}". Birthday job not scheduled.`);
            return;
        }

        birthdayTask = cron.schedule(schedulePattern, async () => {
            console.log('[CRON] Checking birthday notification configuration...');
            try {
                await runBirthdayNotifications(tz);
            } catch (error) {
                console.error('[CRON] Error running birthday notifications:', error);
            }
        }, { timezone: tz });

        const nextRun = typeof birthdayTask.getNextRun === 'function' ? birthdayTask.getNextRun() : null;
        console.log(
            `[CRON] Starting birthday notification cron job with schedule: ${schedulePattern} (timezone: ${tz})` +
            (nextRun ? ` — next run ${nextRun.toISOString()}` : '')
        );
    } catch (err) {
        console.error('Failed to start birthday notification cron:', err);
    }
};

const runAnniversaryNotifications = async (tz) => {
    const Setting = db.settings;

    const enableSetting = await Setting.findOne({ where: { key: 'enable_anniversary_notifications' } });
    const enabled = enableSetting ? enableSetting.value === 'true' : true;

    if (!enabled) {
        console.log('[CRON] Anniversary notifications are disabled in settings. Skipping.');
        return { skipped: 'disabled', wishesSent: 0, digestsSent: 0 };
    }

    const todayLabel = anniversaryUtil.getTodayLongLabel(tz);
    const todayDate = anniversaryUtil.getTodayDateString(tz);
    const anniversaries = await anniversaryUtil.getTodaysAnniversaries(tz);

    if (anniversaries.length === 0) {
        console.log(`[CRON] No staff work anniversaries on ${todayLabel}. Skipping.`);
        return { skipped: 'no_anniversaries', wishesSent: 0, digestsSent: 0 };
    }

    const wishSetting = await Setting.findOne({ where: { key: 'enable_anniversary_wish_emails' } });
    const wishesEnabled = wishSetting ? wishSetting.value === 'true' : true;
    let wishesSent = 0;

    if (wishesEnabled) {
        for (const person of anniversaries) {
            const outcome = await anniversaryUtil.sendAnniversaryWish(person, {
                dateStr: todayDate,
                dateLabel: todayLabel,
                source: 'cron'
            });

            if (outcome.outcome === 'sent') {
                wishesSent++;
            } else if (outcome.outcome === 'no_email') {
                console.warn(`[CRON] Skipping anniversary wish for ${person.name} — no email on record.`);
            } else if (outcome.outcome === 'already_sent') {
                console.log(`[CRON] Anniversary wish for ${person.name} already sent today. Skipping.`);
            } else {
                console.error(`[CRON] Anniversary wish for ${person.name} failed: ${outcome.error}`);
            }
        }
        console.log(`[CRON] Sent ${wishesSent} anniversary wish email(s).`);
    } else {
        console.log('[CRON] Anniversary wish emails are disabled in settings. Sending digest only.');
    }

    const recipients = await anniversaryUtil.getAnniversaryDigestRecipients();
    if (recipients.length === 0) {
        console.warn('[CRON] No users found in the configured anniversary digest roles.');
        return { wishesSent, digestsSent: 0 };
    }

    const subject = anniversaries.length === 1
        ? `🌟 Work Anniversary Today: ${anniversaries[0].name}`
        : `🌟 ${anniversaries.length} Work Anniversaries Today`;

    console.log(`[CRON] Sending anniversary digest (${anniversaries.length} anniversary(s)) to ${recipients.length} recipient(s).`);

    let digestsSent = 0;
    for (const recipient of recipients) {
        const body = anniversaryUtil.buildAnniversaryEmailBody(anniversaries, recipient, todayLabel);
        const result = await emailService.sendEmail(
            recipient.email,
            subject,
            body,
            recipient.secondary_email || null
        );
        if (result.success) digestsSent++;
    }

    return { wishesSent, digestsSent };
};

const startAnniversaryNotificationCron = async () => {
    try {
        const Setting = db.settings;

        stopTask(anniversaryTask);
        anniversaryTask = null;

        await seedAnniversaryTemplates();

        const scheduleSetting = await Setting.findOne({ where: { key: 'anniversary_notification_schedule' } });
        const schedulePattern = scheduleSetting && scheduleSetting.value ? scheduleSetting.value : '0 8 * * *';
        const tz = await getAppTimezone();

        if (!cron.validate(schedulePattern)) {
            console.error(`[CRON] Invalid anniversary cron expression "${schedulePattern}". Anniversary job not scheduled.`);
            return;
        }

        anniversaryTask = cron.schedule(schedulePattern, async () => {
            console.log('[CRON] Checking anniversary notification configuration...');
            try {
                await runAnniversaryNotifications(tz);
            } catch (error) {
                console.error('[CRON] Error running anniversary notifications:', error);
            }
        }, { timezone: tz });

        const nextRun = typeof anniversaryTask.getNextRun === 'function' ? anniversaryTask.getNextRun() : null;
        console.log(
            `[CRON] Starting anniversary notification cron job with schedule: ${schedulePattern} (timezone: ${tz})` +
            (nextRun ? ` — next run ${nextRun.toISOString()}` : '')
        );
    } catch (err) {
        console.error('Failed to start anniversary notification cron:', err);
    }
};

// Settings that change when a job runs. Saving one of these re-registers the
// affected job immediately, so a schedule change does not need a restart.
const CRON_SETTING_KEYS = {
    pending_request_reminder_schedule: ['reminder'],
    birthday_notification_schedule: ['birthday'],
    anniversary_notification_schedule: ['anniversary'],
    application_timezone: ['reminder', 'birthday', 'anniversary']
};

/**
 * Re-register the cron jobs affected by a settings change.
 * Returns true when the key was schedule-related and a reload happened.
 */
const reloadCronForSetting = async (key) => {
    const targets = CRON_SETTING_KEYS[key];
    if (!targets) return false;

    console.log(`[CRON] Setting "${key}" changed — reloading: ${targets.join(', ')}`);

    if (targets.includes('reminder')) await startPendingRequestReminderCron();
    if (targets.includes('birthday')) await startBirthdayNotificationCron();
    if (targets.includes('anniversary')) await startAnniversaryNotificationCron();

    return true;
};

const startCronJobs = () => {
    startPendingRequestReminderCron();
    startBirthdayNotificationCron();
    startAnniversaryNotificationCron();
};

module.exports = {
    startCronJobs,
    startPendingRequestReminderCron,
    startBirthdayNotificationCron,
    startAnniversaryNotificationCron,
    reloadCronForSetting,
    runBirthdayNotifications,
    runAnniversaryNotifications
};

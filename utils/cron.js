const cron = require('node-cron');
const db = require('../models');
const emailService = require('./email.service');
const { Op } = require('sequelize');

const startCronJobs = () => {
    const Setting = db.settings;
    Setting.findOne({ where: { key: 'pending_request_reminder_schedule' } }).then(scheduleSetting => {
        const schedulePattern = scheduleSetting && scheduleSetting.value ? scheduleSetting.value : '0 8 * * *';
        console.log(`[CRON] Starting daily reminder cron job with schedule: ${schedulePattern}`);

        cron.schedule(schedulePattern, async () => {
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
    });
    }).catch(err => {
        console.error('Failed to fetch cron schedule:', err);
    });
};

module.exports = { startCronJobs };

const db = require("../models");
const emailService = require("./email.service");
const { Op } = require("sequelize");
const Setting = db.settings;

const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

exports.notifyNextLevelIfManagerOnLeave = async (manager, applicant, requestType, requestDetails) => {
    try {
        if (!manager || !manager.approving_manager_id) return false;

        const LeaveRequest = db.leave_requests;
        const Staff = db.user;
        const tz = await getAppTimezone();
        
        // Check if manager is on leave today
        const todayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
        const today = `${todayStr.year}-${todayStr.month}-${todayStr.day}`;

        const managerOnLeave = await LeaveRequest.findOne({
            where: {
                staff_id: manager.staffid,
                status: 'Approved',
                start_date: { [Op.lte]: today },
                end_date: { [Op.gte]: today }
            }
        });

        if (managerOnLeave) {
            // Manager is on leave today, notify their manager
            const grandManager = await Staff.findByPk(manager.approving_manager_id);
            if (grandManager && grandManager.email) {
                console.log(`Manager ${manager.firstname} is on leave today. Escalating ${requestType} notification to ${grandManager.email}`);
                
                let templateSlug = "";
                let variables = {
                    user_name: `${applicant.firstname} ${applicant.lastname}`,
                    reason: requestDetails.reason || ''
                };

                if (requestType === 'leave') {
                    templateSlug = "leave_applied";
                    variables.leave_type = requestDetails.leave_type;
                    variables.start_date = requestDetails.start_date;
                    variables.end_date = requestDetails.end_date;
                } else if (requestType === 'time_off') {
                    templateSlug = "timeoff_applied"; 
                    variables.date = requestDetails.date;
                    variables.start_time = requestDetails.start_time;
                    variables.end_time = requestDetails.end_time;
                } else if (requestType === 'onduty') {
                    templateSlug = "onduty_applied"; 
                    variables.client_name = requestDetails.client_name;
                    variables.location = requestDetails.location;
                    variables.purpose = requestDetails.purpose;
                    variables.start_time = requestDetails.start_time;
                    variables.end_time = requestDetails.end_time || '';
                }

                await emailService.sendTemplateEmail(grandManager.email, templateSlug, variables);
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error("Error in notifyNextLevelIfManagerOnLeave:", err);
        return false;
    }
};

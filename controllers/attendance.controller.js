const db = require("../models");
const AttendanceLog = db.attendance_logs;
const OnDutyLog = db.on_duty_logs;
const Approval = db.approvals;
const TblStaff = db.user;
const Setting = db.settings;
const timezoneUtil = require("../utils/timezone.util");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

// Helper to get application timezone
const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

exports.checkIn = async (req, res) => {
    // Validate request
    if (!req.body.latitude || !req.body.longitude) {
        res.status(400).send({
            message: "Location is required!"
        });
        return;
    }

    try {
        const tz = await getAppTimezone();
        const now = new Date();
        // For dateonly "date" field, we need the date in the target timezone
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        // Verify today is not a company holiday
        const { isDateHoliday } = require("../utils/holiday.helper");
        const holidayCheck = await isDateHoliday(todayDateOnly);
        if (holidayCheck.isHoliday) {
            return res.status(400).send({
                message: `Today (${todayDateOnly}) is a company holiday (${holidayCheck.holidayName}). Attendance check-in is not allowed.`
            });
        }

        // Verify employee is not on approved full-day leave today
        const LeaveRequest = db.leave_requests;
        const Op = db.Sequelize.Op;
        const approvedFullDayLeave = await LeaveRequest.findOne({
            where: {
                staff_id: req.userId,
                status: 'Approved',
                start_date: { [Op.lte]: todayDateOnly },
                end_date: { [Op.gte]: todayDateOnly }
            }
        });

        if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
            return res.status(400).send({
                message: "You are on approved leave for today. Attendance check-in is not allowed."
            });
        }

        const attendance = {
            staff_id: req.userId,
            check_in_time: now,
            date: todayDateOnly,
            phone_model: req.body.phone_model,
            ip_address: req.body.ip_address || getClientIp(req),
            latitude: req.body.latitude,
            longitude: req.body.longitude
        };

        const data = await AttendanceLog.create(attendance);
        const staff = await TblStaff.findByPk(req.userId, { attributes: ['staffid', 'firstname', 'lastname'] });
        const staffName = staff ? `${staff.firstname} ${staff.lastname}` : `Staff #${req.userId}`;

        await logActivity({
            admin_id: req.userId,
            action: 'CHECK_IN',
            entity: 'AttendanceLog',
            entity_id: data.id,
            affected_user_id: req.userId,
            description: `${staffName} checked in (GPS/Direct)`,
            new_values: {
                check_in_time: data.check_in_time,
                date: data.date,
                phone_model: data.phone_model,
                latitude: data.latitude,
                longitude: data.longitude
            },
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.send(data);
    } catch (err) {
        res.status(500).send({
            message:
                err.message || "Some error occurred while creating the Attendance Log."
        });
    }
};

exports.checkOut = async (req, res) => {
    try {
        // Find today's attendance log for the user
        const tz = await getAppTimezone();
        const now = new Date();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        const log = await AttendanceLog.findOne({
            where: {
                staff_id: req.userId,
                date: todayDateOnly,
                check_out_time: null
            },
            order: [['check_in_time', 'DESC']]
        });

        if (!log) {
            return res.status(404).send({
                message: "No active check-in found for today."
            });
        }

        const oldCheckOutTime = log.check_out_time;
        const updatedLog = await log.update({
            check_out_time: now
        });

        try {
            console.log('\n=== CheckOut - Creating Approval ===');
            console.log('Staff ID:', req.userId);
            console.log('Attendance Log ID:', updatedLog.id);

            // Get the staff member's approving_manager_id
            const staff = await TblStaff.findByPk(req.userId);

            console.log('Staff found:', !!staff);
            console.log('Staff name:', staff?.firstname, staff?.lastname);
            console.log('Staff role:', staff?.role);
            console.log('Approving Manager ID:', staff?.approving_manager_id);

            if (staff && staff.approving_manager_id) {
                // Create approval record
                const approval = await Approval.create({
                    attendance_log_id: updatedLog.id,
                    manager_id: staff.approving_manager_id,
                    status: 'pending'
                });
                console.log('✅ Approval created successfully');
                console.log('   Approval ID:', approval.id);
                console.log('   Attendance Log ID:', approval.attendance_log_id);
                console.log('   Manager ID:', approval.manager_id);
                console.log('   Status:', approval.status);
            } else {
                console.log('⚠️  Staff has no approving_manager_id - approval NOT created');
            }

            console.log('=== CheckOut Complete ===\n');
        } catch (approvalErr) {
            console.error('❌ Error creating approval:', approvalErr.message);
            console.error(approvalErr.stack);
        }

        const staff = await TblStaff.findByPk(req.userId, { attributes: ['staffid', 'firstname', 'lastname'] });
        const staffName = staff ? `${staff.firstname} ${staff.lastname}` : `Staff #${req.userId}`;

        await logActivity({
            admin_id: req.userId,
            action: 'CHECK_OUT',
            entity: 'AttendanceLog',
            entity_id: updatedLog.id,
            affected_user_id: req.userId,
            description: `${staffName} checked out (GPS/Direct)`,
            old_values: { check_out_time: oldCheckOutTime },
            new_values: { check_out_time: updatedLog.check_out_time },
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.send({ message: "Checked out successfully!" });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Error updating Attendance Log."
        });
    }
};

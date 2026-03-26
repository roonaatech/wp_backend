const db = require("../models");
const AttendanceLog = db.attendance_logs;
const OnDutyLog = db.on_duty_logs;
const Approval = db.approvals;
const Setting = db.settings;
const { Op } = require("sequelize");

// Helper to get application timezone
const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

// Helper to format Date in app timezone as YYYY-MM-DD HH:mm:ss
const formatDateInTimezone = (dateObj, tz) => {
    if (!dateObj) return null;
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(new Date(dateObj));
        const p = {};
        parts.forEach(part => { p[part.type] = part.value; });
        return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
    } catch (e) {
        return String(dateObj);
    }
};

// Get attendance history
exports.getAttendanceHistory = async (req, res) => {
    try {
        const { type } = req.query;
        const tz = await getAppTimezone();
        let items = [];

        if (type === 'checkins') {
            const rawItems = await AttendanceLog.findAll({
                where: { staff_id: req.userId },
                order: [['check_in_time', 'DESC']],
                limit: 50
            });
            for (let item of rawItems) {
                const approval = await Approval.findOne({
                    where: { attendance_log_id: item.id }
                });
                const plain = item.get({ plain: true });
                plain.check_in_time = formatDateInTimezone(plain.check_in_time, tz);
                plain.check_out_time = formatDateInTimezone(plain.check_out_time, tz);
                plain.approval_status = approval?.status || 'pending';
                items.push(plain);
            }
        } else if (type === 'checkouts') {
            const rawItems = await AttendanceLog.findAll({
                where: {
                    staff_id: req.userId,
                    check_out_time: { [Op.ne]: null }
                },
                order: [['check_out_time', 'DESC']],
                limit: 50
            });
            for (let item of rawItems) {
                const approval = await Approval.findOne({
                    where: { attendance_log_id: item.id }
                });
                const plain = item.get({ plain: true });
                plain.check_in_time = formatDateInTimezone(plain.check_in_time, tz);
                plain.check_out_time = formatDateInTimezone(plain.check_out_time, tz);
                plain.approval_status = approval?.status || 'pending';
                items.push(plain);
            }
        } else if (type === 'onduty') {
            const rawItems = await OnDutyLog.findAll({
                where: { staff_id: req.userId },
                order: [['start_time', 'DESC']],
                limit: 50
            });
            for (let item of rawItems) {
                const approval = await Approval.findOne({
                    where: { on_duty_log_id: item.id }
                });
                const plain = item.get({ plain: true });
                plain.start_time = formatDateInTimezone(plain.start_time, tz);
                plain.end_time = formatDateInTimezone(plain.end_time, tz);
                plain.approval_status = approval?.status || 'pending';
                items.push(plain);
            }
        } else if (type === 'onduty_active') {
            const rawItems = await OnDutyLog.findAll({
                where: {
                    staff_id: req.userId,
                    end_time: null
                },
                order: [['start_time', 'DESC']],
                limit: 50
            });
            for (let item of rawItems) {
                const approval = await Approval.findOne({
                    where: { on_duty_log_id: item.id }
                });
                const plain = item.get({ plain: true });
                plain.start_time = formatDateInTimezone(plain.start_time, tz);
                plain.end_time = formatDateInTimezone(plain.end_time, tz);
                plain.approval_status = approval?.status || 'pending';
                items.push(plain);
            }
        } else if (type === 'inprogress') {
            const rawItems = await AttendanceLog.findAll({
                where: {
                    staff_id: req.userId,
                    check_in_time: { [Op.ne]: null },
                    check_out_time: null
                },
                order: [['check_in_time', 'DESC']],
                limit: 50
            });
            for (let item of rawItems) {
                const approval = await Approval.findOne({
                    where: { attendance_log_id: item.id }
                });
                const plain = item.get({ plain: true });
                plain.check_in_time = formatDateInTimezone(plain.check_in_time, tz);
                plain.check_out_time = formatDateInTimezone(plain.check_out_time, tz);
                plain.approval_status = approval?.status || 'pending';
                items.push(plain);
            }
        }

        res.status(200).send({ items });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

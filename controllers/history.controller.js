const db = require("../models");
const AttendanceLog = db.attendance_logs;
const OnDutyLog = db.on_duty_logs;
const Approval = db.approvals;
const { Op } = require("sequelize");

// Get attendance history
exports.getAttendanceHistory = async (req, res) => {
    try {
        const { type } = req.query;
        let items = [];

        if (type === 'checkins') {
            items = await AttendanceLog.findAll({
                where: { staff_id: req.userId },
                order: [['check_in_time', 'DESC']],
                limit: 50
            });
            // Manually add approval_status for each item
            for (let item of items) {
                const approval = await Approval.findOne({
                    where: { attendance_log_id: item.id }
                });
                item.dataValues.approval_status = approval?.status || 'pending';
            }
        } else if (type === 'checkouts') {
            items = await AttendanceLog.findAll({
                where: {
                    staff_id: req.userId,
                    check_out_time: { [Op.ne]: null }
                },
                order: [['check_out_time', 'DESC']],
                limit: 50
            });
            // Manually add approval_status for each item
            for (let item of items) {
                const approval = await Approval.findOne({
                    where: { attendance_log_id: item.id }
                });
                item.dataValues.approval_status = approval?.status || 'pending';
            }
        } else if (type === 'onduty') {
            items = await OnDutyLog.findAll({
                where: { staff_id: req.userId },
                order: [['start_time', 'DESC']],
                limit: 50
            });
            // Manually add approval_status for each item
            for (let item of items) {
                const approval = await Approval.findOne({
                    where: { on_duty_log_id: item.id }
                });
                item.dataValues.approval_status = approval?.status || 'pending';
            }
        } else if (type === 'onduty_active') {
            // Get all on-duty logs that are currently active (end_time is null)
            items = await OnDutyLog.findAll({
                where: {
                    staff_id: req.userId,
                    end_time: null
                },
                order: [['start_time', 'DESC']],
                limit: 50
            });
            // Manually add approval_status for each item
            for (let item of items) {
                const approval = await Approval.findOne({
                    where: { on_duty_log_id: item.id }
                });
                item.dataValues.approval_status = approval?.status || 'pending';
            }
        } else if (type === 'inprogress') {
            // Get all check-ins without check-out (in progress)
            items = await AttendanceLog.findAll({
                where: {
                    staff_id: req.userId,
                    check_in_time: { [Op.ne]: null },
                    check_out_time: null
                },
                order: [['check_in_time', 'DESC']],
                limit: 50
            });
            // Manually add approval_status for each item
            for (let item of items) {
                const approval = await Approval.findOne({
                    where: { attendance_log_id: item.id }
                });
                item.dataValues.approval_status = approval?.status || 'pending';
            }
        }

        res.status(200).send({ items });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

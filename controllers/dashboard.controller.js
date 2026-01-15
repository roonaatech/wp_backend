const db = require("../models");
const AttendanceLog = db.attendance_logs;
const OnDutyLog = db.on_duty_logs;
const { Op } = require("sequelize");

// Get dashboard statistics for the current user
exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayDateOnly = today.toISOString().split('T')[0];

        // Total check-ins (all time)
        const totalCheckIns = await AttendanceLog.count({
            where: { staff_id: req.userId }
        });

        // Total check-outs (all time)
        const totalCheckOuts = await AttendanceLog.count({
            where: {
                staff_id: req.userId,
                check_out_time: { [Op.ne]: null }
            }
        });

        // In-progress attendance (checked in but not checked out)
        const inProgressAttendance = await AttendanceLog.count({
            where: {
                staff_id: req.userId,
                check_in_time: { [Op.ne]: null },
                check_out_time: null
            }
        });

        // Total on-duty visits (all time)
        const totalOnDuty = await OnDutyLog.count({
            where: { staff_id: req.userId }
        });

        // In-progress on-duty visits (where end_time is null)
        const inProgressOnDuty = await OnDutyLog.count({
            where: {
                staff_id: req.userId,
                end_time: null
            }
        });

        res.status(200).send({
            totalCheckIns,
            totalCheckOuts,
            inProgressAttendance,
            totalOnDuty,
            inProgressOnDuty
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

const db = require("../models");
const AttendanceLog = db.attendance_logs;

// Get today's active attendance for the current user
exports.getTodayAttendance = (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    AttendanceLog.findOne({
        where: {
            staff_id: req.userId,
            date: today,
            check_out_time: null // Only get if not checked out
        },
        order: [['check_in_time', 'DESC']]
    })
        .then(attendance => {
            if (!attendance) {
                return res.status(200).send({ checkedIn: false });
            }
            res.status(200).send({
                checkedIn: true,
                data: attendance
            });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

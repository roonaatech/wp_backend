const db = require("../models");
const AttendanceLog = db.attendance_logs;

// Get today's active attendance for the current user
exports.getTodayAttendance = async (req, res) => {
    try {
        const Setting = db.settings;
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        const tz = tzSetting ? tzSetting.value : 'Asia/Kolkata';

        // Use Intl to get today's date string in target timezone
        const nowIST = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        const [m, d, y] = nowIST.split('/');
        const todayDateOnly = `${y}-${m}-${d}`;

        const attendance = await AttendanceLog.findOne({
            where: {
                staff_id: req.userId,
                date: todayDateOnly,
                check_out_time: null // Only get if not checked out
            },
            order: [['check_in_time', 'DESC']]
        });

        if (!attendance) {
            return res.status(200).send({ checkedIn: false });
        }

        // Format times for display consistency
        const formatTime = (dateObj) => {
            if (!dateObj) return null;
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false, hourCycle: 'h23'
            });
            const parts = formatter.formatToParts(new Date(dateObj));
            const p = {};
            parts.forEach(part => { p[part.type] = part.value; });
            return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
        };

        const plain = attendance.get({ plain: true });
        plain.check_in_time = formatTime(plain.check_in_time);
        plain.check_out_time = formatTime(plain.check_out_time);

        res.status(200).send({
            checkedIn: true,
            data: plain
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

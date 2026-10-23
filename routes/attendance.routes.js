const controller = require("../controllers/facial_attendance.controller");
const { 
    verifyToken, 
    canAccessWebApp, 
    canAccessAttendancePortal,
    canViewAttendanceReport,
    canEditAttendance,
    canDeleteAttendance
} = require("../middleware/authJwt");
const { requireAttendanceModule } = require("../middleware/moduleGuard");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Kiosk Attendance Terminal: Direct check-in / check-out
    app.post(
        "/api/attendance/kiosk-record",
        [requireAttendanceModule, verifyToken, canAccessAttendancePortal],
        controller.recordKioskAttendance
    );

    // Dynamic Employee Smart Badge: Get current user's signed dynamic QR badge
    app.get(
        "/api/attendance/my-badge",
        [requireAttendanceModule, verifyToken],
        controller.getMyBadgeData
    );

    // WFH Remote Attendance: Get current user's WFH status and today's log
    app.get(
        "/api/attendance/wfh-status",
        [requireAttendanceModule, verifyToken],
        controller.getWfhAttendanceStatus
    );

    // WFH Remote Attendance: Self-service Check-In / Check-Out punch with GPS & Device Binding
    app.post(
        "/api/attendance/wfh-punch",
        [requireAttendanceModule, verifyToken],
        controller.wfhPunch
    );

    // Kiosk Attendance Terminal: Scan dynamic QR badge to record check-in / check-out
    app.post(
        "/api/attendance/scan-qr-badge",
        [requireAttendanceModule, verifyToken, canAccessAttendancePortal],
        controller.scanQrBadgeAttendance
    );

    // Kiosk Attendance Terminal: Staff list
    app.get(
        "/api/attendance/staff-list",
        [requireAttendanceModule, verifyToken, canAccessAttendancePortal],
        controller.getStaffList
    );

    // Check employee attendance status for today (used by portal/kiosk and mobile app)
    app.get(
        "/api/attendance/status/:email",
        [requireAttendanceModule, verifyToken],
        controller.getAttendanceStatus
    );

    // Current employee's attendance status today (web and mobile app)
    // Note: Controller handles disabled state gracefully so Leave/Time-Off can still query safely
    app.get(
        "/api/attendance/today",
        [verifyToken],
        controller.getMyTodayAttendance
    );

    // Current employee's dates with recorded attendance check-ins
    // Note: Controller handles disabled state gracefully so Leave/Time-Off can still query safely
    app.get(
        "/api/attendance/my-attended-dates",
        [verifyToken],
        controller.getMyAttendedDates
    );

    // Check Attendance Terminal / Kiosk Access Status
    app.get(
        "/api/attendance/terminal-status",
        [requireAttendanceModule, verifyToken],
        controller.getTerminalStatus
    );

    // Admin/Manager/Employee: Fetch attendance logs with filters
    app.get(
        "/api/admin/attendance-logs",
        [requireAttendanceModule, verifyToken, canViewAttendanceReport],
        controller.getAttendanceLogsReport
    );

    // Edit attendance log
    app.put(
        "/api/admin/attendance-logs/:id",
        [requireAttendanceModule, verifyToken, canEditAttendance],
        controller.updateAttendanceLog
    );

    // Delete attendance log
    app.delete(
        "/api/admin/attendance-logs/:id",
        [requireAttendanceModule, verifyToken, canDeleteAttendance],
        controller.deleteAttendanceLog
    );
};

const controller = require("../controllers/facial_attendance.controller");
const { 
    verifyToken, 
    canAccessWebApp, 
    canAccessAttendancePortal,
    canViewAttendanceReport,
    canEditAttendance,
    canDeleteAttendance
} = require("../middleware/authJwt");

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
        [verifyToken, canAccessAttendancePortal],
        controller.recordKioskAttendance
    );

    // Dynamic Employee Smart Badge: Get current user's signed dynamic QR badge
    app.get(
        "/api/attendance/my-badge",
        [verifyToken],
        controller.getMyBadgeData
    );

    // WFH Remote Attendance: Get current user's WFH status and today's log
    app.get(
        "/api/attendance/wfh-status",
        [verifyToken],
        controller.getWfhAttendanceStatus
    );

    // WFH Remote Attendance: Self-service Check-In / Check-Out punch with GPS & Device Binding
    app.post(
        "/api/attendance/wfh-punch",
        [verifyToken],
        controller.wfhPunch
    );

    // Kiosk Attendance Terminal: Scan dynamic QR badge to record check-in / check-out
    app.post(
        "/api/attendance/scan-qr-badge",
        [verifyToken, canAccessAttendancePortal],
        controller.scanQrBadgeAttendance
    );

    // Kiosk Attendance Terminal: Staff list
    app.get(
        "/api/attendance/staff-list",
        [verifyToken, canAccessAttendancePortal],
        controller.getStaffList
    );

    // Check employee attendance status for today (used by portal/kiosk and mobile app)
    app.get(
        "/api/attendance/status/:email",
        [verifyToken],
        controller.getAttendanceStatus
    );

    // Current employee's attendance status today (web and mobile app)
    app.get(
        "/api/attendance/today",
        [verifyToken],
        controller.getMyTodayAttendance
    );

    // Current employee's dates with recorded attendance check-ins
    app.get(
        "/api/attendance/my-attended-dates",
        [verifyToken],
        controller.getMyAttendedDates
    );

    // Check Attendance Terminal / Kiosk Access Status
    app.get(
        "/api/attendance/terminal-status",
        [verifyToken],
        controller.getTerminalStatus
    );

    // Backward-compatibility alias for legacy clients
    app.get(
        "/api/attendance/face-status",
        [verifyToken],
        controller.getFaceStatus
    );

    // Deprecated Face Recognition Endpoints (Return 400 with helpful migration guidance)
    app.post(
        "/api/attendance/check-in-out-with-face", 
        [verifyToken, canAccessAttendancePortal], 
        controller.checkInOutWithFace
    );

    app.post(
        "/api/attendance/identify-face",
        [verifyToken, canAccessAttendancePortal],
        controller.identifyFace
    );

    app.post(
        "/api/attendance/register-face", 
        [verifyToken], 
        controller.registerFace
    );

    app.post(
        "/api/admin/users/:id/register-face", 
        [verifyToken, canAccessWebApp], 
        controller.registerFace
    );

    app.delete(
        "/api/admin/users/:id/face",
        [verifyToken, canAccessWebApp],
        controller.removeFace
    );

    // Admin/Manager/Employee: Fetch attendance logs with filters
    app.get(
        "/api/admin/attendance-logs",
        [verifyToken, canViewAttendanceReport],
        controller.getAttendanceLogsReport
    );

    // Edit attendance log
    app.put(
        "/api/admin/attendance-logs/:id",
        [verifyToken, canEditAttendance],
        controller.updateAttendanceLog
    );

    // Delete attendance log
    app.delete(
        "/api/admin/attendance-logs/:id",
        [verifyToken, canDeleteAttendance],
        controller.deleteAttendanceLog
    );
};

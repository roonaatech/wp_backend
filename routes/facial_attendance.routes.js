const controller = require("../controllers/facial_attendance.controller");
const { 
    verifyToken, 
    canAccessWebApp, 
    canManageUsers,
    canAccessAttendancePortal,
    canViewAttendanceReport,
    canManageAttendance
} = require("../middleware/authJwt");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Public / Receptionist-Authenticated: Verify user credentials and check-in/out via face match
    app.post(
        "/api/attendance/check-in-out-with-face", 
        [verifyToken, canAccessWebApp, canAccessAttendancePortal], 
        controller.checkInOutWithFace
    );

    // Check employee attendance status for today (used by the portal to show correct button)
    app.get(
        "/api/attendance/status/:email",
        [verifyToken, canAccessWebApp, canAccessAttendancePortal],
        controller.getAttendanceStatus
    );

    // Identify employee by face descriptor (auto-fill email in the portal)
    app.post(
        "/api/attendance/identify-face",
        [verifyToken, canAccessWebApp, canAccessAttendancePortal],
        controller.identifyFace
    );

    // Self-Service Face Registration
    app.post(
        "/api/attendance/register-face", 
        [verifyToken], 
        controller.registerFace
    );

    // Admin/HR Face Registration for a specific employee
    app.post(
        "/api/admin/users/:id/register-face", 
        [verifyToken, canManageUsers], 
        controller.registerFace
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
        [verifyToken, canManageAttendance],
        controller.updateAttendanceLog
    );

    // Delete attendance log
    app.delete(
        "/api/admin/attendance-logs/:id",
        [verifyToken, canManageAttendance],
        controller.deleteAttendanceLog
    );
};

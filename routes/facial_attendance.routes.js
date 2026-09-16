const controller = require("../controllers/facial_attendance.controller");
const { 
    verifyToken, 
    canAccessWebApp, 
    canManageUsers,
    isAdminOrAbove,
    canRemoveFace,
    canRegisterFaceId,
    canAccessAttendancePortal,
    canViewAttendanceReport,
    canManageAttendance,
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

    // Public / Receptionist-Authenticated: Verify user credentials and check-in/out via face match
    app.post(
        "/api/attendance/check-in-out-with-face", 
        [verifyToken, canAccessAttendancePortal], 
        controller.checkInOutWithFace
    );

    // Kiosk Attendance Terminal: Direct check-in / check-out
    app.post(
        "/api/attendance/kiosk-record",
        [verifyToken, canAccessAttendancePortal],
        controller.recordKioskAttendance
    );

    // Kiosk Attendance Terminal: Staff list
    app.get(
        "/api/attendance/staff-list",
        [verifyToken, canAccessAttendancePortal],
        controller.getStaffList
    );

    // Check employee attendance status for today (used by the portal/kiosk to show correct button)
    app.get(
        "/api/attendance/status/:email",
        [verifyToken, canAccessAttendancePortal],
        controller.getAttendanceStatus
    );

    // Identify employee by face descriptor (auto-fill email in the portal)
    app.post(
        "/api/attendance/identify-face",
        [verifyToken, canAccessAttendancePortal],
        controller.identifyFace
    );

    // Check Face Registration Status of Current User
    app.get(
        "/api/attendance/face-status",
        [verifyToken],
        controller.getFaceStatus
    );

    // Self-Service Face Registration
    app.post(
        "/api/attendance/register-face", 
        [verifyToken], 
        controller.registerFace
    );

    // Authorized Roles (global permission): Face Registration for a specific employee
    app.post(
        "/api/admin/users/:id/register-face", 
        [verifyToken, canAccessWebApp, canRegisterFaceId], 
        controller.registerFace
    );

    // Authorized Roles (Configured via System Settings): Remove face registration of an employee
    app.delete(
        "/api/admin/users/:id/face",
        [verifyToken, canAccessWebApp, canRemoveFace],
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

const controller = require("../controllers/manual_attendance.controller");
const { verifyToken, canManageManualAttendance } = require("../middleware/authJwt");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Get active employees who missed check-in and/or check-out for date range
    app.get(
        "/api/attendance/missed",
        [verifyToken, canManageManualAttendance],
        controller.getMissedAttendance
    );

    // Save/Regularize manual attendance for single or bulk records
    app.post(
        "/api/attendance/manual-regularize",
        [verifyToken, canManageManualAttendance],
        controller.regularizeAttendance
    );

    // Get recently regularized attendance records
    app.get(
        "/api/attendance/manual-recent",
        [verifyToken, canManageManualAttendance],
        controller.getRecentRegularizations
    );
};

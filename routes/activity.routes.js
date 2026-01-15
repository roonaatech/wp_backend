const { verifyToken, isAdmin } = require("../middleware/authJwt");
const controller = require("../controllers/activity.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Mobile app activity logging (no auth required - token optional)
    app.post("/api/activities/mobile-log", controller.logActivityFromMobile);

    // Get activity summary (must be before other routes to avoid param collision)
    app.get("/api/activities/summary", [verifyToken, isAdmin], controller.getActivitySummary);

    // Export activities as CSV
    app.get("/api/activities/export/csv", [verifyToken, isAdmin], controller.exportActivities);

    // Get user activity history (admin only)
    app.get("/api/activities/user/:userId", [verifyToken, isAdmin], controller.getUserActivityHistory);

    // Get all activities (admin only)
    app.get("/api/activities", [verifyToken, isAdmin], controller.getAllActivities);
};

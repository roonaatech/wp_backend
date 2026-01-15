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

    /**
     * @swagger
     * tags:
     *   name: Activities
     *   description: API for tracking user activities
     */

    /**
     * @swagger
     * /api/activities/mobile-log:
     *   post:
     *     summary: Log activity from mobile app
     *     description: Submit activity logs from the mobile application
     *     tags: [Activities]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               activity_type:
     *                 type: string
     *               details:
     *                 type: string
     *     responses:
     *       200:
     *         description: Activity logged successfully
     */
    app.post("/api/activities/mobile-log", controller.logActivityFromMobile);

    /**
     * @swagger
     * /api/activities/summary:
     *   get:
     *     summary: Get activity summary
     *     description: Retrieve a summary of all activities (Admin only)
     *     tags: [Activities]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Activity summary retrieved successfully
     */
    app.get("/api/activities/summary", [verifyToken, isAdmin], controller.getActivitySummary);

    /**
     * @swagger
     * /api/activities/export/csv:
     *   get:
     *     summary: Export activities as CSV
     *     description: Download activity logs in CSV format (Admin only)
     *     tags: [Activities]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: CSV file download
     */
    app.get("/api/activities/export/csv", [verifyToken, isAdmin], controller.exportActivities);

    /**
     * @swagger
     * /api/activities/user/{userId}:
     *   get:
     *     summary: Get user activity history
     *     description: Retrieve activity history for a specific user (Admin only)
     *     tags: [Activities]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: User activity history retrieved successfully
     */
    app.get("/api/activities/user/:userId", [verifyToken, isAdmin], controller.getUserActivityHistory);

    /**
     * @swagger
     * /api/activities:
     *   get:
     *     summary: Get all activities
     *     description: Retrieve all activity logs (Admin only)
     *     tags: [Activities]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: List of all activities
     */
    app.get("/api/activities", [verifyToken, isAdmin], controller.getAllActivities);
};

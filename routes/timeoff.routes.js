const { authJwt } = require("../middleware");
const controller = require("../controllers/timeoff.controller");

/**
 * @swagger
 * /api/timeoff/apply:
 *   post:
 *     tags: [Time-Off]
 *     summary: Apply for time-off
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, start_time, end_time, reason]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *                 example: "10:00"
 *               end_time:
 *                 type: string
 *                 example: "12:00"
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Applied successfully
 */

/**
 * @swagger
 * /api/timeoff/{id}/status:
 *   put:
 *     tags: [Time-Off]
 *     summary: Update status (Approve/Reject)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [Approved, Rejected] }
 *               rejection_reason: { type: string }
 *     responses:
 *       200:
 *         description: Status updated
 */

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post("/api/timeoff/apply", [authJwt.verifyToken], controller.applyTimeOff);
    app.put("/api/timeoff/:id", [authJwt.verifyToken], controller.updateTimeOffDetails);
    app.put("/api/timeoff/:id/status", [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.updateTimeOffStatus);
    app.delete("/api/timeoff/:id", [authJwt.verifyToken], controller.deleteTimeOff);
    app.get("/api/timeoff/my-history", [authJwt.verifyToken], controller.getMyTimeOffRequests);
};

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
 * /api/timeoff/{id}:
 *   put:
 *     tags: [Time-Off]
 *     summary: Update time-off request details
 *     description: Update the details of a pending time-off request (only the requester can update)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Time-off request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2024-03-15"
 *               start_time:
 *                 type: string
 *                 example: "10:00"
 *                 description: Start time in HH:MM format
 *               end_time:
 *                 type: string
 *                 example: "12:00"
 *                 description: End time in HH:MM format
 *               reason:
 *                 type: string
 *                 example: Doctor appointment
 *     responses:
 *       200:
 *         description: Time-off request updated successfully
 *       400:
 *         description: Invalid input or request already processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the request owner
 *       404:
 *         description: Time-off request not found
 */

/**
 * @swagger
 * /api/timeoff/{id}/status:
 *   put:
 *     tags: [Time-Off]
 *     summary: Update status (Approve/Reject)
 *     description: Approve or reject a time-off request (requires manager or admin permission)
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
 *       400:
 *         description: Invalid status or request already processed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Time-off request not found
 */

/**
 * @swagger
 * /api/timeoff/{id}:
 *   delete:
 *     tags: [Time-Off]
 *     summary: Delete a time-off request
 *     description: Delete a pending time-off request (only the requester can delete)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Time-off request ID
 *     responses:
 *       200:
 *         description: Time-off request deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Time-off request deleted successfully.
 *       400:
 *         description: Cannot delete a processed request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not the request owner
 *       404:
 *         description: Time-off request not found
 */

/**
 * @swagger
 * /api/timeoff/my-history:
 *   get:
 *     tags: [Time-Off]
 *     summary: Get my time-off request history
 *     description: Retrieve all time-off requests for the authenticated user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Time-off request history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   staff_id:
 *                     type: integer
 *                   date:
 *                     type: string
 *                     format: date
 *                   start_time:
 *                     type: string
 *                   end_time:
 *                     type: string
 *                   reason:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [Pending, Approved, Rejected]
 *                   rejection_reason:
 *                     type: string
 *                   manager_id:
 *                     type: integer
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
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

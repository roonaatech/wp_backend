const { authJwt } = require("../middleware");
const controller = require("../controllers/onduty.controller");

/**
 * @swagger
 * /api/onduty/start:
 *   post:
 *     tags:
 *       - On-Duty
 *     summary: Start on-duty logging
 *     description: Initialize on-duty session with location and purpose
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_name
 *               - purpose
 *               - location
 *               - start_lat
 *               - start_long
 *             properties:
 *               client_name:
 *                 type: string
 *                 example: ABC Corporation
 *               purpose:
 *                 type: string
 *                 example: Client meeting
 *               location:
 *                 type: string
 *                 example: Conference Hall
 *               start_lat:
 *                 type: number
 *                 format: double
 *                 example: 13.0827
 *               start_long:
 *                 type: number
 *                 format: double
 *                 example: 80.2707
 *     responses:
 *       201:
 *         description: On-duty started successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/onduty/end:
 *   post:
 *     tags:
 *       - On-Duty
 *     summary: End on-duty logging
 *     description: Complete on-duty session with end location
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - end_lat
 *               - end_long
 *             properties:
 *               end_lat:
 *                 type: number
 *                 format: double
 *                 example: 13.0950
 *               end_long:
 *                 type: number
 *                 format: double
 *                 example: 80.2800
 *     responses:
 *       200:
 *         description: On-duty ended successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/onduty/active:
 *   get:
 *     tags:
 *       - On-Duty
 *     summary: Get active on-duty session
 *     description: Retrieve current active on-duty session for user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Active on-duty session retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnDutyLog'
 *       404:
 *         description: No active on-duty session
 *       401:
 *         description: Unauthorized
 */

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post("/api/onduty/start", [authJwt.verifyToken], controller.startOnDuty);
    app.post("/api/onduty/end", [authJwt.verifyToken], controller.endOnDuty);

    /**
     * @swagger
     * /api/onduty/active-all:
     *   get:
     *     tags: [On-Duty]
     *     summary: Get all active on-duty sessions
     *     description: Retrieve all currently active on-duty sessions (Manager/Admin only)
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: List of active on-duty sessions retrieved
     */
    app.get("/api/onduty/active-all", [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getAllActiveOnDuty);

    app.get("/api/onduty/active", [authJwt.verifyToken], controller.getActiveOnDuty);

    /**
     * @swagger
     * /api/onduty:
     *   get:
     *     tags: [On-Duty]
     *     summary: Get on-duty logs by status
     *     description: Retrieve on-duty logs filtered by status (Manager/Admin only)
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - name: status
     *         in: query
     *         schema:
     *           type: string
     *           enum: [Pending, Approved, Rejected]
     *     responses:
     *       200:
     *         description: On-duty logs retrieved successfully
     */
    app.get("/api/onduty", [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getOnDutyByStatus);

    /**
     * @swagger
     * /api/onduty/{id}:
     *   put:
     *     tags: [On-Duty]
     *     summary: Update on-duty session details
     *     description: Modify an existing on-duty log
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - name: id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: On-duty details updated successfully
     */
    app.put("/api/onduty/:id", [authJwt.verifyToken], controller.updateOnDutyDetails);

    /**
     * @swagger
     * /api/onduty/{id}:
     *   delete:
     *     tags:
     *       - On-Duty
     *     summary: Delete an on-duty log
     *     description: Delete a pending on-duty log by its ID
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: The on-duty log ID
     *     responses:
     *       200:
     *         description: On-duty request deleted successfully
     *       403:
     *         description: Cannot delete a processed request
     *       404:
     *         description: On-duty request not found
     */
    app.delete("/api/onduty/:id", [authJwt.verifyToken], controller.deleteOnDuty);
};

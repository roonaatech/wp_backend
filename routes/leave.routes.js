const { authJwt } = require("../middleware");
const controller = require("../controllers/leave.controller");

/**
 * @swagger
 * /api/leave/apply:
 *   post:
 *     tags:
 *       - Leave Requests
 *     summary: Apply for leave
 *     description: Submit a new leave request
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leave_type
 *               - start_date
 *               - end_date
 *               - reason
 *             properties:
 *               leave_type:
 *                 type: string
 *                 example: Vacation
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: 2025-12-15
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: 2025-12-20
 *               reason:
 *                 type: string
 *                 example: Family vacation
 *     responses:
 *       201:
 *         description: Leave applied successfully
 *       400:
 *         description: Invalid input or overlapping leave
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/leave/my-history:
 *   get:
 *     tags:
 *       - Leave Requests
 *     summary: Get user's leave history
 *     description: Retrieve all leave requests for the current user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Leave history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaves:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaveRequest'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/leave/requests:
 *   get:
 *     tags:
 *       - Leave Management
 *     summary: Get manageable leave requests (Admin/Manager)
 *     description: Retrieve all pending, approved, and rejected leave requests with pagination
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [Pending, Approved, Rejected]
 *         example: Pending
 *       - name: page
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         example: 10
 *     responses:
 *       200:
 *         description: Requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/LeaveRequest'
 *                       - $ref: '#/components/schemas/OnDutyLog'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only managers and admins can access this
 */

/**
 * @swagger
 * /api/leave/{id}/status:
 *   put:
 *     tags:
 *       - Leave Management
 *     summary: Update leave request status
 *     description: Approve, reject, or revert leave request status
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Approved, Rejected, Pending]
 *               rejection_reason:
 *                 type: string
 *                 description: Required if status is Rejected
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Leave request not found
 */

/**
 * @swagger
 * /api/onduty/{id}/status:
 *   put:
 *     tags:
 *       - On-Duty Management
 *     summary: Update on-duty request status
 *     description: Approve, reject, or revert on-duty request status
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Approved, Rejected, Pending]
 *               rejection_reason:
 *                 type: string
 *                 description: Required if status is Rejected
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: On-duty request not found
 */

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/api/leave/apply",
        [authJwt.verifyToken],
        controller.applyLeave
    );

    app.put(
        "/api/leave/:id",
        [authJwt.verifyToken],
        controller.updateLeaveDetails
    );

    app.get(
        "/api/leave/my-history",
        [authJwt.verifyToken],
        controller.getMyLeaves
    );

    app.get(
        "/api/leave/pending",
        [authJwt.verifyToken, authJwt.isManagerOrAdmin],
        controller.getPendingLeaves
    );

    app.get(
        "/api/leave/requests",
        [authJwt.verifyToken, authJwt.isManagerOrAdmin],
        controller.getManageableRequests
    );

    app.put(
        "/api/leave/:id/status",
        [authJwt.verifyToken, authJwt.isManagerOrAdmin],
        controller.updateLeaveStatus
    );

    // On-Duty Approval Routes
    app.put("/api/onduty/:id/status", [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.updateOnDutyStatus);

    // Stats
    app.get(
        "/api/admin/stats",
        [authJwt.verifyToken, authJwt.isManagerOrAdmin],
        controller.getAdminStats
    );
    app.get(
        "/api/leave/my-stats",
        [authJwt.verifyToken],
        controller.getMyStats
    );

    // Delete a leave request
    app.delete(
        "/api/leave/:id",
        [authJwt.verifyToken],
        controller.deleteLeave
    );

    // Get leave balance for a user
    app.get(
        "/api/leave/user-balance/:userId",
        [authJwt.verifyToken, authJwt.isManagerOrAdmin],
        controller.getUserLeaveBalance
    );

    // Get current user's leave balance (for mobile app)
    app.get(
        "/api/leave/my-balance",
        [authJwt.verifyToken],
        controller.getMyLeaveBalance
    );
};

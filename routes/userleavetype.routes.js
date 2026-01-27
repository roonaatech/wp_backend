const { authJwt } = require("../middleware");
const controller = require("../controllers/userleavetype.controller.js");

module.exports = app => {
    /**
     * @swagger
     * /api/user/{userId}/leave-types:
     *   get:
     *     summary: Get user leave types
     *     description: Retrieve all leave types allocated to a specific user with remaining days
     *     tags:
     *       - User Leave Types
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *         description: User/Staff ID
     *     responses:
     *       200:
     *         description: User leave types with allocation and usage details
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 allOf:
     *                   - $ref: '#/components/schemas/UserLeaveType'
     *                   - type: object
     *                     properties:
     *                       leave_type:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: integer
     *                           name:
     *                             type: string
     *                           description:
     *                             type: string
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: User not found
     */
    app.get("/api/user/:userId/leave-types", [authJwt.verifyToken], controller.getUserLeaveTypes);

    /**
     * @swagger
     * /api/user/{userId}/leave-types:
     *   put:
     *     summary: Update user leave types
     *     description: Update allocated days for user leave types (Admin only)
     *     tags:
     *       - User Leave Types
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *         description: User/Staff ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: array
     *             items:
     *               type: object
     *               required:
     *                 - leave_type_id
     *                 - allocated_days
     *               properties:
     *                 leave_type_id:
     *                   type: integer
     *                   description: Leave Type ID
     *                 allocated_days:
     *                   type: number
     *                   description: Number of days allocated for this leave type
     *     responses:
     *       200:
     *         description: User leave types updated successfully
     *       400:
     *         description: Bad request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     *       404:
     *         description: User not found
     */
    app.put("/api/user/:userId/leave-types", [authJwt.verifyToken], controller.updateUserLeaveTypes);
};

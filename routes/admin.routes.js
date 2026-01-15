const { verifyToken } = require("../middleware/authJwt");
const controller = require("../controllers/admin.controller");

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
     * /api/admin/dashboard/stats:
     *   get:
     *     summary: Get dashboard statistics
     *     description: Fetch overall dashboard statistics including pending approvals, approved requests, and rejected requests
     *     tags: [Dashboard]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Dashboard statistics retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 pending_leave_requests:
     *                   type: integer
     *                 pending_on_duty:
     *                   type: integer
     *                 approved_leave_requests:
     *                   type: integer
     *                 approved_on_duty:
     *                   type: integer
     *                 rejected_leave_requests:
     *                   type: integer
     *                 rejected_on_duty:
     *                   type: integer
     *       401:
     *         description: Unauthorized - Invalid or missing token
     */
    app.get("/api/admin/dashboard/stats", [verifyToken], controller.getDashboardStats);

    /**
     * @swagger
     * /api/admin/dashboard/daily-trend:
     *   get:
     *     summary: Get daily approval trend data
     *     description: Fetch daily approval trends for a specified duration (7, 14, or 30 days)
     *     tags: [Dashboard]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: days
     *         schema:
     *           type: integer
     *           enum: [7, 14, 30]
     *           default: 7
     *         description: Number of days to fetch trend data for
     *     responses:
     *       200:
     *         description: Daily trend data retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   date:
     *                     type: string
     *                     format: date
     *                   approvals:
     *                     type: integer
     *       401:
     *         description: Unauthorized - Invalid or missing token
     */
    app.get("/api/admin/dashboard/daily-trend", [verifyToken], controller.getDailyTrendData);

    /**
     * @swagger
     * /api/admin/calendar:
     *   get:
     *     summary: Get calendar events for leave and on-duty
     *     description: Fetch approved leave requests and on-duty logs for a specified month. Admins see all staff, managers see only their reportees.
     *     tags: [Calendar]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: year
     *         schema:
     *           type: integer
     *         description: Year (e.g., 2025)
     *       - in: query
     *         name: month
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 12
     *         description: Month (1-12)
     *     responses:
     *       200:
     *         description: Calendar events retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   date:
     *                     type: string
     *                     format: date
     *                   type:
     *                     type: string
     *                     enum: [leave, on_duty]
     *                   staff_name:
     *                     type: string
     *                   title:
     *                     type: string
     *                   reason:
     *                     type: string
     *       401:
     *         description: Unauthorized - Invalid or missing token
     */
    app.get("/api/admin/calendar", [verifyToken], controller.getCalendarEvents);

    /**
     * @swagger
     * /api/admin/calendar/debug:
     *   get:
     *     summary: Debug calendar data (troubleshooting)
     *     description: Get debug information about calendar data including reportees and counts. Admins see total counts, managers see reportee information.
     *     tags: [Calendar]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Debug information retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 userId:
     *                   type: integer
     *                 userName:
     *                   type: string
     *                 isAdmin:
     *                   type: boolean
     *                 reportees:
     *                   type: array
     *                 leaveCounts:
     *                   type: object
     *                 onDutyCounts:
     *                   type: object
     *       401:
     *         description: Unauthorized - Invalid or missing token
     */
    app.get("/api/admin/calendar/debug", [verifyToken], controller.debugCalendarData);

    /**
     * @swagger
     * /api/admin/users:
     *   get:
     *     summary: Get all users
     *     description: Retrieve a paginated list of all staff members
     *     tags: [Users]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Records per page
     *     responses:
     *       200:
     *         description: Users retrieved successfully
     *       401:
     *         description: Unauthorized
     *   post:
     *     summary: Create a new user
     *     description: Create a new staff member
     *     tags: [Users]
     *     security:
     *       - ApiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               firstname:
     *                 type: string
     *               lastname:
     *                 type: string
     *               email:
     *                 type: string
     *               phonenumber:
     *                 type: string
     *               password:
     *                 type: string
     *               role:
     *                 type: string
     *     responses:
     *       200:
     *         description: User created successfully
     *       400:
     *         description: Invalid input
     *       401:
     *         description: Unauthorized
     */
    app.get("/api/admin/users", [verifyToken], controller.getAllUsers);

    /**
     * @swagger
     * /api/admin/managers-admins:
     *   get:
     *     summary: Get all managers and admins
     *     description: Retrieve list of all managers and administrators
     *     tags: [Users]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Managers and admins retrieved successfully
     *       401:
     *         description: Unauthorized
     */
    app.get("/api/admin/managers-admins", [verifyToken], controller.getManagersAndAdmins);

    app.post("/api/admin/users", [verifyToken], controller.createUser);

    /**
     * @swagger
     * /api/admin/users/{id}:
     *   put:
     *     summary: Update user details
     *     description: Update information for a specific staff member
     *     tags: [Users]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: Staff ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: User updated successfully
     *       400:
     *         description: Invalid input
     *       401:
     *         description: Unauthorized
     */
    app.put("/api/admin/users/:id", [verifyToken], controller.updateUser);

    /**
     * @swagger
     * /api/admin/approvals:
     *   get:
     *     summary: Get pending approvals
     *     description: Retrieve a paginated list of pending leave and on-duty approvals
     *     tags: [Approvals]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Records per page
     *     responses:
     *       200:
     *         description: Approvals retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 pagination:
     *                   $ref: '#/components/schemas/PaginationMeta'
     *                 leave_requests:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/LeaveRequest'
     *                 on_duty_logs:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/OnDutyLog'
     *       401:
     *         description: Unauthorized
     */
    app.get("/api/admin/approvals", [verifyToken], controller.getPendingApprovals);

    /**
     * @swagger
     * /api/admin/approvals/{id}:
     *   put:
     *     summary: Approve or reject an attendance request
     *     description: Update the approval status of a leave request or on-duty log
     *     tags: [Approvals]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Request ID in format "type_id" (e.g., "leave_123" or "onduty_456")
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               status:
     *                 type: string
     *                 enum: [Approved, Rejected]
     *               rejection_reason:
     *                 type: string
     *                 description: Required if status is Rejected
     *     responses:
     *       200:
     *         description: Approval updated successfully
     *       400:
     *         description: Invalid input
     *       401:
     *         description: Unauthorized
     */
    app.put("/api/admin/approvals/:id", [verifyToken], controller.approveAttendance);

    /**
     * @swagger
     * /api/admin/reports:
     *   get:
     *     summary: Get attendance reports
     *     description: Retrieve detailed attendance reports with filtering and pagination
     *     tags: [Reports]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *     responses:
     *       200:
     *         description: Reports retrieved successfully
     *       401:
     *         description: Unauthorized
     */
    app.get("/api/admin/reports", [verifyToken], controller.getAttendanceReports);
};

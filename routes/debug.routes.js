module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Debug routes are only available in non-production environments
    if (process.env.NODE_ENV === 'production') {
        return;
    }

    const db = require("../models");
    const { authJwt } = require("../middleware");

    /**
     * @swagger
     * tags:
     *   name: Debug
     *   description: API for system debugging and troubleshooting (development only)
     */

    /**
     * @swagger
     * /api/debug/approvals-count:
     *   get:
     *     summary: Get counts of various entities for debugging (development only)
     *     description: Retrieve counts of approvals, on-duty logs, and attendance logs
     *     tags: [Debug]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Debug counts retrieved successfully
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Role management permission required
     */
    app.get("/api/debug/approvals-count", [authJwt.verifyToken, authJwt.canManageRoles], async (req, res) => {
        try {
            const approvals = await db.approvals.findAll();
            const onDutyLogs = await db.on_duty_logs.findAll();
            const attendanceLogs = await db.attendance_logs.findAll();

            console.log('\n=== DEBUG ENDPOINT ===');
            console.log('Approvals:', approvals.length);
            console.log('On-Duty Logs:', onDutyLogs.length);
            console.log('Attendance Logs:', attendanceLogs.length);

            res.send({
                approvals_count: approvals.length,
                on_duty_logs_count: onDutyLogs.length,
                attendance_logs_count: attendanceLogs.length,
                approvals: approvals.map(a => ({
                    id: a.id,
                    attendance_log_id: a.attendance_log_id,
                    on_duty_log_id: a.on_duty_log_id,
                    manager_id: a.manager_id,
                    status: a.status
                }))
            });
        } catch (err) {
            console.error('Debug endpoint error:', err);
            res.status(500).send({ error: err.message });
        }
    });
};

const { authJwt } = require("../middleware");
const controller = require("../controllers/setting.controller");

/**
 * @swagger
 * /api/settings/public:
 *   get:
 *     tags:
 *       - System Settings
 *     summary: Get public settings
 *     description: Retrieve all publicly accessible system settings without authentication
 *     responses:
 *       200:
 *         description: Public settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       key:
 *                         type: string
 *                       value:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                       is_public:
 *                         type: boolean
 *                 map:
 *                   type: object
 *                   description: Key-value map of settings for easy access
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     tags:
 *       - System Settings
 *     summary: Get system settings
 *     description: Retrieve system settings with optional filtering by key or category (requires authentication)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: key
 *         schema:
 *           type: string
 *         description: Filter by specific setting key
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (e.g., general, email, attendance)
 *       - in: query
 *         name: include_public_only
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Only return public settings if set to 'true'
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   type: array
 *                   items:
 *                     type: object
 *                 map:
 *                   type: object
 *                   description: Key-value map of settings
 *                 byCategory:
 *                   type: object
 *                   description: Settings grouped by category
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/settings:
 *   post:
 *     tags:
 *       - System Settings
 *     summary: Update or create a system setting
 *     description: Create a new setting or update an existing one (requires system settings management permission)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 example: max_leave_days_per_request
 *                 description: Unique identifier for the setting
 *               value:
 *                 type: string
 *                 example: "30"
 *                 description: Setting value (stored as string)
 *               description:
 *                 type: string
 *                 example: Maximum number of days allowed per leave request
 *               category:
 *                 type: string
 *                 example: leave
 *                 description: Category to group related settings
 *               data_type:
 *                 type: string
 *                 enum: [string, number, boolean, email, url, json, date]
 *                 example: number
 *                 description: Data type for validation
 *               validation_rules:
 *                 type: string
 *                 example: '{"min": 1, "max": 365, "required": true}'
 *                 description: JSON string containing validation rules
 *               is_public:
 *                 type: boolean
 *                 example: false
 *                 description: Whether setting is accessible without authentication
 *               display_order:
 *                 type: integer
 *                 example: 10
 *                 description: Order for displaying settings in UI
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Setting updated successfully.
 *                 setting:
 *                   type: object
 *       400:
 *         description: Validation error or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized or insufficient permissions
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Public endpoint - no authentication required
    app.get(
        "/api/settings/public",
        controller.getPublicSettings
    );

    // Get settings (authenticated)
    app.get(
        "/api/settings",
        [authJwt.verifyToken],
        controller.getSettings
    );

    // Update/create setting (requires system settings permission)
    app.post(
        "/api/settings",
        [authJwt.verifyToken, authJwt.canManageSystemSettings],
        controller.updateSetting
    );
};

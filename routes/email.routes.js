const { authJwt } = require("../middleware");
const controller = require("../controllers/email.controller");

/**
 * @swagger
 * /api/email/config:
 *   get:
 *     tags:
 *       - Email Management
 *     summary: Get email configuration
 *     description: Retrieve the active email server configuration (requires email management permission)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Email configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 provider_type:
 *                   type: string
 *                   example: smtp
 *                 host:
 *                   type: string
 *                   example: smtp.gmail.com
 *                 port:
 *                   type: integer
 *                   example: 587
 *                 secure:
 *                   type: boolean
 *                   example: false
 *                 auth_user:
 *                   type: string
 *                   example: noreply@example.com
 *                 auth_pass:
 *                   type: string
 *                   description: SMTP password
 *                 from_name:
 *                   type: string
 *                   example: WorkPulse System
 *                 from_email:
 *                   type: string
 *                   example: noreply@example.com
 *                 is_active:
 *                   type: boolean
 *       401:
 *         description: Unauthorized or insufficient permissions
 *       404:
 *         description: No active configuration found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/email/config:
 *   post:
 *     tags:
 *       - Email Management
 *     summary: Update or create email configuration
 *     description: Create or update the email server configuration (requires email management permission)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider_type
 *               - host
 *               - port
 *               - auth_user
 *               - auth_pass
 *               - from_email
 *             properties:
 *               provider_type:
 *                 type: string
 *                 example: smtp
 *                 description: Email provider type
 *               host:
 *                 type: string
 *                 example: smtp.gmail.com
 *                 description: SMTP server hostname
 *               port:
 *                 type: integer
 *                 example: 587
 *                 description: SMTP server port
 *               secure:
 *                 type: boolean
 *                 example: false
 *                 description: Use TLS/SSL
 *               auth_user:
 *                 type: string
 *                 example: noreply@example.com
 *                 description: SMTP authentication username
 *               auth_pass:
 *                 type: string
 *                 example: your-app-password
 *                 description: SMTP authentication password
 *               from_name:
 *                 type: string
 *                 example: WorkPulse System
 *                 description: Display name for sent emails
 *               from_email:
 *                 type: string
 *                 example: noreply@example.com
 *                 description: Sender email address
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Configuration saved successfully.
 *                 config:
 *                   type: object
 *       401:
 *         description: Unauthorized or insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/email/test:
 *   post:
 *     tags:
 *       - Email Management
 *     summary: Send a test email
 *     description: Send a test email to verify email configuration (requires email management permission)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *                 description: Recipient email address for test
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Test email sent successfully.
 *                 messageId:
 *                   type: string
 *       401:
 *         description: Unauthorized or insufficient permissions
 *       500:
 *         description: Failed to send email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /api/email/templates:
 *   get:
 *     tags:
 *       - Email Management
 *     summary: Get all email templates
 *     description: Retrieve all email templates for various system notifications (requires email management permission)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Email templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   template_name:
 *                     type: string
 *                     example: leave_approval
 *                   subject:
 *                     type: string
 *                     example: Your leave request has been approved
 *                   body_html:
 *                     type: string
 *                     description: HTML content of the email template
 *                   variables:
 *                     type: string
 *                     description: JSON string of available variables for template
 *                   is_active:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized or insufficient permissions
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/email/templates/{id}:
 *   put:
 *     tags:
 *       - Email Management
 *     summary: Update an email template
 *     description: Update an existing email template (requires email management permission)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               template_name:
 *                 type: string
 *                 example: leave_approval
 *               subject:
 *                 type: string
 *                 example: Your leave request has been approved
 *               body_html:
 *                 type: string
 *                 description: HTML content of the email template
 *               variables:
 *                 type: string
 *                 description: JSON string of available variables
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Template updated successfully.
 *                 template:
 *                   type: object
 *       401:
 *         description: Unauthorized or insufficient permissions
 *       404:
 *         description: Template not found
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

    app.get(
        "/api/email/config",
        [authJwt.verifyToken, authJwt.canManageEmailSettings],
        controller.getConfig
    );

    app.post(
        "/api/email/config",
        [authJwt.verifyToken, authJwt.canManageEmailSettings],
        controller.updateConfig
    );

    app.post(
        "/api/email/test",
        [authJwt.verifyToken, authJwt.canManageEmailSettings],
        controller.sendTestEmail
    );

    app.get(
        "/api/email/templates",
        [authJwt.verifyToken, authJwt.canManageEmailSettings],
        controller.getTemplates
    );

    app.put(
        "/api/email/templates/:id",
        [authJwt.verifyToken, authJwt.canManageEmailSettings],
        controller.updateTemplate
    );
};

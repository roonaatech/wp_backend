const controller = require("../controllers/role.controller");
const { authJwt } = require("../middleware");

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
     * /api/roles:
     *   get:
     *     summary: Get all roles
     *     description: Retrieve a list of all roles (any authenticated user can read)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: List of all roles
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Role'
     *       401:
     *         description: Unauthorized
     */
    app.get(
        "/api/roles",
        [authJwt.verifyToken],
        controller.findAll
    );

    /**
     * @swagger
     * /api/roles/statistics:
     *   get:
     *     summary: Get role statistics
     *     description: Get statistics for all roles including user counts (Admin only)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Role statistics
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 allOf:
     *                   - $ref: '#/components/schemas/Role'
     *                   - type: object
     *                     properties:
     *                       user_count:
     *                         type: integer
     *                         description: Number of users with this role
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.get(
        "/api/roles/statistics",
        [authJwt.verifyToken, authJwt.canManageRoles],
        controller.getStatistics
    );

    /**
     * @swagger
     * /api/roles/{id}:
     *   get:
     *     summary: Get single role by ID
     *     description: Retrieve details of a specific role (Admin only)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: Role ID
     *     responses:
     *       200:
     *         description: Role details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Role'
     *       404:
     *         description: Role not found
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.get(
        "/api/roles/:id",
        [authJwt.verifyToken, authJwt.canManageRoles],
        controller.findOne
    );

    /**
     * @swagger
     * /api/roles:
     *   post:
     *     summary: Create new role
     *     description: Create a new role with permissions (Admin only)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - display_name
     *             properties:
     *               name:
     *                 type: string
     *               display_name:
     *                 type: string
     *               description:
     *                 type: string
     *               hierarchy_level:
     *                 type: integer
     *               can_approve_leave:
     *                 type: boolean
     *               can_approve_onduty:
     *                 type: boolean
     *               can_manage_users:
     *                 type: boolean
     *               can_manage_leave_types:
     *                 type: boolean
     *               can_view_reports:
     *                 type: boolean
     *     responses:
     *       201:
     *         description: Role created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Role'
     *       400:
     *         description: Bad request or role name already exists
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.post(
        "/api/roles",
        [authJwt.verifyToken, authJwt.canManageRoles],
        controller.create
    );

    /**
     * @swagger
     * /api/roles/{id}:
     *   put:
     *     summary: Update role
     *     description: Update role details and permissions (Admin only)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: Role ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               display_name:
     *                 type: string
     *               description:
     *                 type: string
     *               hierarchy_level:
     *                 type: integer
     *               can_approve_leave:
     *                 type: boolean
     *               can_approve_onduty:
     *                 type: boolean
     *               can_manage_users:
     *                 type: boolean
     *               can_manage_leave_types:
     *                 type: boolean
     *               can_view_reports:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Role updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Role'
     *       404:
     *         description: Role not found
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.put(
        "/api/roles/:id",
        [authJwt.verifyToken, authJwt.canManageRoles],
        controller.update
    );

    /**
     * @swagger
     * /api/roles/{id}:
     *   delete:
     *     summary: Delete role
     *     description: Delete a role (cannot delete if users are assigned) (Admin only)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: Role ID
     *     responses:
     *       200:
     *         description: Role deleted successfully
     *       400:
     *         description: Cannot delete role - users assigned
     *       404:
     *         description: Role not found
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.delete(
        "/api/roles/:id",
        [authJwt.verifyToken, authJwt.canManageRoles],
        controller.delete
    );

    /**
     * @swagger
     * /api/roles/hierarchy/update:
     *   put:
     *     summary: Update role hierarchy
     *     description: Bulk update hierarchy levels for multiple roles (Admin only)
     *     tags:
     *       - Roles
     *     security:
     *       - ApiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: array
     *             items:
     *               type: object
     *               required:
     *                 - id
     *                 - hierarchy_level
     *               properties:
     *                 id:
     *                   type: integer
     *                   description: Role ID
     *                 hierarchy_level:
     *                   type: integer
     *                   description: New hierarchy level
     *     responses:
     *       200:
     *         description: Hierarchy updated successfully
     *       400:
     *         description: Bad request
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.put(
        "/api/roles/hierarchy/update",
        [authJwt.verifyToken, authJwt.canManageRoles],
        controller.updateHierarchy
    );
};

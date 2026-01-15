const { authJwt } = require("../middleware");
const controller = require("../controllers/leavetype.controller");

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
     * tags:
     *   name: Leave Types
     *   description: API for managing leave types
     */

    /**
     * @swagger
     * /api/leavetypes:
     *   get:
     *     summary: Get all active leave types
     *     description: Retrieve all leave types that are currently active
     *     tags: [Leave Types]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: List of leave types
     */
    app.get(
        "/api/leavetypes",
        [authJwt.verifyToken],
        controller.findAll
    );

    /**
     * @swagger
     * /api/leavetypes/user/filtered:
     *   get:
     *     summary: Get leave types filtered by user gender
     *     description: Retrieve leave types appropriate for the user's gender
     *     tags: [Leave Types]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: Filtered list of leave types
     */
    app.get(
        "/api/leavetypes/user/filtered",
        [authJwt.verifyToken],
        controller.findByUserGender
    );

    /**
     * @swagger
     * /api/leavetypes/admin/all:
     *   get:
     *     summary: Get all leave types (Admin)
     *     description: Retrieve all leave types including inactive ones
     *     tags: [Leave Types]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: List of all leave types
     */
    app.get(
        "/api/leavetypes/admin/all",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.findAllAdmin
    );

    /**
     * @swagger
     * /api/leavetypes:
     *   post:
     *     summary: Create a new leave type
     *     description: Add a new leave type to the system (Admin only)
     *     tags: [Leave Types]
     *     security:
     *       - ApiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               days:
     *                 type: integer
     *               gender:
     *                 type: string
     *                 enum: [Male, Female, All]
     *     responses:
     *       201:
     *         description: Leave type created successfully
     */
    app.post(
        "/api/leavetypes",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.create
    );

    /**
     * @swagger
     * /api/leavetypes/{id}:
     *   put:
     *     summary: Update a leave type
     *     description: Modify an existing leave type (Admin only)
     *     tags: [Leave Types]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
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
     *         description: Leave type updated successfully
     */
    app.put(
        "/api/leavetypes/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.update
    );

    /**
     * @swagger
     * /api/leavetypes/{id}:
     *   delete:
     *     summary: Delete a leave type
     *     description: Remove a leave type from the system (Admin only)
     *     tags: [Leave Types]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Leave type deleted successfully
     */
    app.delete(
        "/api/leavetypes/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.delete
    );
};

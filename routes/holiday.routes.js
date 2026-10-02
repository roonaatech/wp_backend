const { authJwt } = require("../middleware");
const controller = require("../controllers/holiday.controller");

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
     *   name: Holidays
     *   description: API for managing company holidays
     */

    /**
     * @swagger
     * /api/holidays/years:
     *   get:
     *     summary: Get available years for holidays
     *     tags: [Holidays]
     *     security:
     *       - ApiKeyAuth: []
     *     responses:
     *       200:
     *         description: List of available years
     */
    app.get(
        "/api/holidays/years",
        [authJwt.verifyToken],
        controller.getYears
    );

    /**
     * @swagger
     * /api/holidays:
     *   get:
     *     summary: Get all holidays (optionally filtered by year)
     *     tags: [Holidays]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: query
     *         name: year
     *         schema:
     *           type: integer
     *         description: Filter holidays by 4-digit year
     *       - in: query
     *         name: status
     *         schema:
     *           type: integer
     *         description: 1 for active, 0 for inactive
     *     responses:
     *       200:
     *         description: List of holidays
     */
    app.get(
        "/api/holidays",
        [authJwt.verifyToken],
        controller.findAll
    );

    /**
     * @swagger
     * /api/holidays/{date}:
     *   get:
     *     summary: Get single holiday by date
     *     tags: [Holidays]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: date
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Holiday details
     */
    app.get(
        "/api/holidays/:date",
        [authJwt.verifyToken, authJwt.canManageHolidays],
        controller.findOne
    );

    /**
     * @swagger
     * /api/holidays:
     *   post:
     *     summary: Create a new holiday
     *     tags: [Holidays]
     *     security:
     *       - ApiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               holiday_date:
     *                 type: string
     *                 format: date
     *               holiday_name:
     *                 type: string
     *               status:
     *                 type: integer
     *     responses:
     *       201:
     *         description: Holiday created successfully
     */
    app.post(
        "/api/holidays",
        [authJwt.verifyToken, authJwt.canManageHolidays],
        controller.create
    );

    /**
     * @swagger
     * /api/holidays/{date}:
     *   put:
     *     summary: Update a holiday
     *     tags: [Holidays]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: date
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               holiday_name:
     *                 type: string
     *               status:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Holiday updated successfully
     */
    app.put(
        "/api/holidays/:date",
        [authJwt.verifyToken, authJwt.canManageHolidays],
        controller.update
    );

    /**
     * @swagger
     * /api/holidays/{date}:
     *   delete:
     *     summary: Delete a holiday
     *     tags: [Holidays]
     *     security:
     *       - ApiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: date
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Holiday deleted successfully
     */
    app.delete(
        "/api/holidays/:date",
        [authJwt.verifyToken, authJwt.canManageHolidays],
        controller.delete
    );
};

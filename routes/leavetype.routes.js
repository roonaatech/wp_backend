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

    // Get all active leave types (for users)
    app.get(
        "/api/leavetypes",
        [authJwt.verifyToken],
        controller.findAll
    );

    // Get leave types filtered by user's gender
    app.get(
        "/api/leavetypes/user/filtered",
        [authJwt.verifyToken],
        controller.findByUserGender
    );

    // Get all leave types including inactive (for admin)
    app.get(
        "/api/leavetypes/admin/all",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.findAllAdmin
    );

    // Create new leave type (admin only)
    app.post(
        "/api/leavetypes",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.create
    );

    // Update leave type (admin only)
    app.put(
        "/api/leavetypes/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.update
    );

    // Delete leave type (admin only)
    app.delete(
        "/api/leavetypes/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.delete
    );
};

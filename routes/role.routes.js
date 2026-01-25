const controller = require("../controllers/role.controller");
const { authJwt } = require("../middleware");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Get all roles
    app.get(
        "/api/roles",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.findAll
    );

    // Get role statistics
    app.get(
        "/api/roles/statistics",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.getStatistics
    );

    // Get single role
    app.get(
        "/api/roles/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.findOne
    );

    // Create new role
    app.post(
        "/api/roles",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.create
    );

    // Update role
    app.put(
        "/api/roles/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.update
    );

    // Delete role
    app.delete(
        "/api/roles/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.delete
    );

    // Update hierarchy (bulk update)
    app.put(
        "/api/roles/hierarchy/update",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateHierarchy
    );
};

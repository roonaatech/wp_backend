const { authJwt } = require("../middleware");
const controller = require("../controllers/setting.controller");

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

const { authJwt } = require("../middleware");
const controller = require("../controllers/email.controller");

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

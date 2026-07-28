const controller = require("../controllers/openhours.controller");
const { verifyToken, canAccessWebApp } = require("../middleware/authJwt");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Look up a US business address's Monday-Friday opening hours via Google Places API
    app.post(
        "/api/open-hours/lookup",
        [verifyToken, canAccessWebApp],
        controller.lookupOpenHours
    );
};

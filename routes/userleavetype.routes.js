const { authJwt } = require("../middleware");
const controller = require("../controllers/userleavetype.controller.js");

module.exports = app => {
    app.get("/api/user/:userId/leave-types", [authJwt.verifyToken], controller.getUserLeaveTypes);
    app.put("/api/user/:userId/leave-types", [authJwt.verifyToken], controller.updateUserLeaveTypes);
};

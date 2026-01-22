const { authJwt } = require("../middleware");
const controller = require("../controllers/apk.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Configure multer for file upload
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = "uploads/apk";
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            // timestamp-originalName
            cb(null, Date.now() + "-" + file.originalname);
        }
    });

    const upload = multer({ storage: storage });

    app.post(
        "/api/apk/upload",
        [authJwt.verifyToken, authJwt.isAdmin, upload.single("file")],
        controller.uploadApk
    );

    app.get(
        "/api/apk/list",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.getAllApks
    );

    app.get(
        "/api/apk/latest",
        controller.getLatestApk
    );

    app.get(
        "/api/apk/download/:id",
        controller.downloadApk
    );

    app.delete(
        "/api/apk/:id",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteApk
    );

    app.put(
        "/api/apk/:id/visibility",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateVisibility
    );
};

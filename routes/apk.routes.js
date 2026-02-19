const { authJwt } = require("../middleware");
const controller = require("../controllers/apk.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * @swagger
 * /api/apk/parse:
 *   post:
 *     tags:
 *       - APK Management
 *     summary: Parse APK file to extract version info
 *     description: Upload an APK file temporarily to extract version information without saving (requires admin permission)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: APK file to parse (max 200MB)
 *     responses:
 *       200:
 *         description: APK parsed successfully
 *       400:
 *         description: Invalid APK file or parsing error
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: APK parsing not available
 */

/**
 * @swagger
 * /api/apk/upload:
 *   post:
 *     tags:
 *       - APK Management
 *     summary: Upload a new APK version
 *     description: Upload a new mobile app version (requires admin permission)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - version
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               version:
 *                 type: string
 *                 example: 1.0.0+5
 *               release_notes:
 *                 type: string
 *               is_visible:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: APK uploaded successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Version already exists
 */

/**
 * @swagger
 * /api/apk/list:
 *   get:
 *     tags:
 *       - APK Management
 *     summary: Get all APK versions
 *     description: Retrieve paginated list of all uploaded APK versions (requires admin permission)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: APK list retrieved successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/apk/latest:
 *   get:
 *     tags:
 *       - APK Management
 *     summary: Get latest visible APK
 *     description: Retrieve the most recent visible APK version (public endpoint)
 *     responses:
 *       200:
 *         description: Latest APK retrieved
 *       404:
 *         description: No APK found
 */

/**
 * @swagger
 * /api/apk/check-version:
 *   post:
 *     tags:
 *       - APK Management
 *     summary: Check if app update is required
 *     description: Compare current app version with latest available (public endpoint)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - app_version
 *             properties:
 *               app_version:
 *                 type: string
 *                 example: 1.0.0+3
 *     responses:
 *       200:
 *         description: Version check completed
 *       400:
 *         description: App version required
 */

/**
 * @swagger
 * /api/apk/download/{id}:
 *   get:
 *     tags:
 *       - APK Management
 *     summary: Download an APK file
 *     description: Download a specific APK by ID or 'latest' (public endpoint)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: latest
 *     responses:
 *       200:
 *         description: APK file download
 *         content:
 *           application/vnd.android.package-archive:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: APK not found
 */

/**
 * @swagger
 * /api/apk/{id}:
 *   delete:
 *     tags:
 *       - APK Management
 *     summary: Delete an APK version
 *     description: Delete an APK version and its file (requires admin permission)
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
 *         description: APK deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: APK not found
 */

/**
 * @swagger
 * /api/apk/{id}/visibility:
 *   put:
 *     tags:
 *       - APK Management
 *     summary: Update APK visibility
 *     description: Update whether an APK version is visible to users (requires admin permission)
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
 *             required:
 *               - is_visible
 *             properties:
 *               is_visible:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Visibility updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: APK not found
 */

/**
 * @swagger
 * /api/apk/{id}/release-notes:
 *   put:
 *     tags:
 *       - APK Management
 *     summary: Update APK release notes
 *     description: Update the release notes for an APK version (requires admin permission)
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
 *             required:
 *               - release_notes
 *             properties:
 *               release_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Release notes updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: APK not found
 */

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

    const upload = multer({ 
        storage: storage,
        limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit for APK files
    });

    // Configure multer for temp file parsing (separate storage for temp files)
    const tempStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const tempDir = "uploads/temp";
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
        },
        filename: (req, file, cb) => {
            cb(null, "parse-" + Date.now() + "-" + file.originalname);
        }
    });

    const tempUpload = multer({ 
        storage: tempStorage,
        limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit for parsing
    });

    // Parse APK to extract version info (for auto-populating version field)
    app.post(
        "/api/apk/parse",
        [authJwt.verifyToken, authJwt.isAdmin, tempUpload.single("file")],
        controller.parseApk
    );

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

    // Check app version - public endpoint for mobile app
    app.post(
        "/api/apk/check-version",
        controller.checkVersion
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

    app.put(
        "/api/apk/:id/release-notes",
        [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateReleaseNotes
    );
};

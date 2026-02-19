const db = require("../models");
const ApkVersion = db.apk_versions;
const User = db.user;
const fs = require("fs");
const path = require("path");

// Try to load app-info-parser, but gracefully handle if not installed
let AppInfoParser;
try {
    AppInfoParser = require("app-info-parser");
} catch (e) {
    console.warn("⚠️ app-info-parser module not installed. APK version parsing will not be available.");
    console.warn("   Run 'npm install app-info-parser' to enable this feature.");
}

// Parse APK file and extract version info
exports.parseApk = async (req, res) => {
    console.log("📦 APK parse request received");
    
    // Check if parser is available
    if (!AppInfoParser) {
        console.error("❌ app-info-parser module is not installed");
        return res.status(503).send({
            success: false,
            message: "APK parsing is not available. Please install 'app-info-parser' module on the server."
        });
    }
    
    try {
        if (!req.file) {
            console.log("❌ No file in request");
            return res.status(400).send({ message: "No file uploaded!" });
        }

        console.log(`📁 Parsing file: ${req.file.originalname} (${req.file.size} bytes)`);
        const filePath = path.resolve(req.file.path);
        
        try {
            const parser = new AppInfoParser(filePath);
            const result = await parser.parse();
            
            console.log(`✅ APK parsed successfully: version=${result.versionName}, versionCode=${result.versionCode}`);
            
            // Clean up the temp file
            fs.unlinkSync(filePath);
            
            res.status(200).send({
                success: true,
                version: result.versionName || null,
                versionCode: result.versionCode || null,
                packageName: result.package || null,
                appName: result.application?.label || null,
                minSdkVersion: result.usesSdk?.minSdkVersion || null,
                targetSdkVersion: result.usesSdk?.targetSdkVersion || null
            });
        } catch (parseErr) {
            // Clean up the temp file on error
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            console.error("❌ Error parsing APK:", parseErr.message);
            res.status(400).send({
                success: false,
                message: "Could not parse APK file. Please ensure it's a valid APK. Error: " + parseErr.message
            });
        }
    } catch (err) {
        console.error("❌ Error in parseApk:", err);
        res.status(500).send({
            success: false,
            message: "Error processing APK file. " + err.message
        });
    }
};

exports.uploadApk = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded!" });
        }

        const { version, release_notes, is_visible } = req.body;

        // Check if version already exists
        const existingApk = await ApkVersion.findOne({
            where: { version: version }
        });

        if (existingApk) {
            // Delete the uploaded file since we're rejecting the upload
            if (req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(409).send({ 
                message: `Version ${version} already exists. Please increment the build number and try again.`,
                errorType: 'DUPLICATE_VERSION'
            });
        }

        // Get the latest version and check if new version is higher
        const latestApk = await ApkVersion.findOne({
            order: [['upload_date', 'DESC']]
        });

        if (latestApk) {
            const comparison = compareVersions(version, latestApk.version);
            if (comparison < 0) {
                // New version is lower than current latest
                if (req.file.path && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).send({
                    message: `Version ${version} is lower than the current latest version (${latestApk.version}). Please upload a higher version.`,
                    errorType: 'LOWER_VERSION',
                    currentLatest: latestApk.version
                });
            }
        }

        const apk = await ApkVersion.create({
            version: version,
            filename: req.file.filename,
            filepath: req.file.path,
            uploaded_by: req.userId,
            release_notes: release_notes,
            is_visible: is_visible === 'true' || is_visible === true
        });

        res.status(200).send({
            message: "APK uploaded successfully!",
            apk: apk
        });
    } catch (err) {
        console.error("Error uploading APK:", err);
        res.status(500).send({
            message: "Could not upload APK. " + err.message
        });
    }
};

exports.getAllApks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows: apks } = await ApkVersion.findAndCountAll({
            include: [{
                model: User,
                as: 'uploader',
                attributes: ['firstname', 'lastname', 'email']
            }],
            order: [['upload_date', 'DESC']],
            limit: limit,
            offset: offset
        });

        const totalPages = Math.ceil(count / limit);

        res.status(200).send({
            data: apks,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: count,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving apks."
        });
    }
};

exports.getLatestApk = async (req, res) => {
    try {
        const apk = await ApkVersion.findOne({
            where: { is_visible: true },
            order: [['upload_date', 'DESC']],
            include: [{
                model: User,
                as: 'uploader',
                attributes: ['firstname', 'lastname']
            }]
        });

        if (!apk) {
            return res.status(404).send({ message: "No APK found." });
        }

        res.status(200).send(apk);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Error retrieving latest APK."
        });
    }
};

exports.downloadApk = async (req, res) => {
    try {
        const id = req.params.id;
        let apk;

        if (id === 'latest') {
            apk = await ApkVersion.findOne({
                where: { is_visible: true },
                order: [['upload_date', 'DESC']]
            });
        } else {
            apk = await ApkVersion.findByPk(id);
        }

        if (!apk) {
            return res.status(404).send({ message: "APK not found." });
        }

        const filePath = path.resolve(apk.filepath);
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            
            // Set proper headers for APK download - prevent any transformation
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `attachment; filename="${apk.filename}"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Content-Transfer-Encoding', 'binary');
            
            // Stream the file directly instead of using res.download to have more control
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } else {
            res.status(404).send({ message: "File not found on server." });
        }
    } catch (err) {
        res.status(500).send({
            message: "Could not download file. " + err.message
        });
    }
};

exports.deleteApk = async (req, res) => {
    try {
        const id = req.params.id;
        const apk = await ApkVersion.findByPk(id);

        if (!apk) {
            return res.status(404).send({ message: "APK not found." });
        }

        // Delete file from filesystem
        const filePath = path.resolve(apk.filepath);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await apk.destroy();
        res.status(200).send({ message: "APK deleted successfully!" });
    } catch (err) {
        res.status(500).send({
            message: "Could not delete APK. " + err.message
        });
    }
};

exports.updateVisibility = async (req, res) => {
    try {
        const id = req.params.id;
        const { is_visible } = req.body;

        const apk = await ApkVersion.findByPk(id);
        if (!apk) {
            return res.status(404).send({ message: "APK not found." });
        }

        apk.is_visible = is_visible;
        await apk.save();

        res.status(200).send({ message: "Visibility updated successfully!" });
    } catch (err) {
        res.status(500).send({
            message: "Error updating visibility. " + err.message
        });
    }
};

exports.updateReleaseNotes = async (req, res) => {
    try {
        const id = req.params.id;
        const { release_notes } = req.body;

        if (release_notes === undefined) {
            return res.status(400).send({ message: "Release notes are required." });
        }

        const apk = await ApkVersion.findByPk(id);
        if (!apk) {
            return res.status(404).send({ message: "APK not found." });
        }

        apk.release_notes = release_notes;
        await apk.save();

        res.status(200).send({
            message: "Release notes updated successfully!",
            apk: apk
        });
    } catch (err) {
        res.status(500).send({
            message: "Error updating release notes. " + err.message
        });
    }
};

// Helper function to compare version strings (e.g., "1.0.0+1" vs "1.0.1+2")
// Supports formats: "1.0.0", "1.0.0+7", "1.3.0+8"
const compareVersions = (v1, v2) => {
    // Parse version and build number (e.g., "1.3.0+7" -> { version: "1.3.0", build: 7 })
    const parseVersion = (v) => {
        const [versionPart, buildPart] = v.split('+');
        return {
            version: versionPart,
            build: buildPart ? parseInt(buildPart, 10) : 0
        };
    };
    
    const parsed1 = parseVersion(v1);
    const parsed2 = parseVersion(v2);
    
    // Compare semantic version parts first
    const parts1 = parsed1.version.split('.').map(Number);
    const parts2 = parsed2.version.split('.').map(Number);
    
    // Ensure both arrays have the same length
    const maxLength = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLength) parts1.push(0);
    while (parts2.length < maxLength) parts2.push(0);
    
    for (let i = 0; i < maxLength; i++) {
        if (parts1[i] > parts2[i]) return 1;  // v1 is greater
        if (parts1[i] < parts2[i]) return -1; // v2 is greater
    }
    
    // Semantic versions are equal, compare build numbers
    if (parsed1.build > parsed2.build) return 1;  // v1 has higher build
    if (parsed1.build < parsed2.build) return -1; // v2 has higher build
    
    return 0; // versions are completely equal
};

// Check if app version is up to date
exports.checkVersion = async (req, res) => {
    try {
        const { app_version } = req.body;
        
        if (!app_version) {
            return res.status(400).send({ 
                message: "App version is required.",
                updateRequired: false 
            });
        }

        // Get the latest visible APK
        const latestApk = await ApkVersion.findOne({
            where: { is_visible: true },
            order: [['upload_date', 'DESC']]
        });

        if (!latestApk) {
            // No APK available, allow login
            return res.status(200).send({
                updateRequired: false,
                message: "No update available."
            });
        }

        const comparison = compareVersions(app_version, latestApk.version);
        
        if (comparison < 0) {
            // App version is older than latest
            return res.status(200).send({
                updateRequired: true,
                currentVersion: app_version,
                latestVersion: latestApk.version,
                releaseNotes: latestApk.release_notes,
                downloadUrl: `/api/apk/download/latest`,
                message: `A new version (${latestApk.version}) is available. Please update to continue.`
            });
        }

        // App is up to date
        return res.status(200).send({
            updateRequired: false,
            currentVersion: app_version,
            latestVersion: latestApk.version,
            message: "App is up to date."
        });
    } catch (err) {
        console.error("Error checking version:", err);
        res.status(500).send({
            message: "Error checking version. " + err.message,
            updateRequired: false // Allow login on error to not block users
        });
    }
};

// Helper function exported for use in auth controller
exports.isVersionOutdated = async (appVersion) => {
    if (!appVersion) return { outdated: false };
    
    const latestApk = await ApkVersion.findOne({
        where: { is_visible: true },
        order: [['upload_date', 'DESC']]
    });
    
    if (!latestApk) return { outdated: false };
    
    const comparison = compareVersions(appVersion, latestApk.version);
    
    if (comparison < 0) {
        return {
            outdated: true,
            currentVersion: appVersion,
            latestVersion: latestApk.version,
            releaseNotes: latestApk.release_notes,
            downloadUrl: `/api/apk/download/latest`
        };
    }
    
    return { outdated: false };
};

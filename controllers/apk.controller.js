const db = require("../models");
const ApkVersion = db.apk_versions;
const User = db.user;
const fs = require("fs");
const path = require("path");

exports.uploadApk = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded!" });
        }

        const { version, release_notes, is_visible } = req.body;

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
        const apks = await ApkVersion.findAll({
            include: [{
                model: User,
                as: 'uploader',
                attributes: ['firstname', 'lastname', 'email']
            }],
            order: [['upload_date', 'DESC']]
        });
        res.status(200).send(apks);
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
            res.download(filePath, apk.filename);
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

// Helper function to compare version strings (e.g., "1.0.0" vs "1.0.1")
const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    // Ensure both arrays have the same length
    const maxLength = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLength) parts1.push(0);
    while (parts2.length < maxLength) parts2.push(0);
    
    for (let i = 0; i < maxLength; i++) {
        if (parts1[i] > parts2[i]) return 1;  // v1 is greater
        if (parts1[i] < parts2[i]) return -1; // v2 is greater
    }
    return 0; // versions are equal
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

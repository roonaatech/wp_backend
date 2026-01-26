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

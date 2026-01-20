const db = require("../models");
const config = process.env;
const TblStaff = db.user;
const axios = require('axios'); // For PHP API
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

const PHP_AUTH_API_URL = process.env.PHP_AUTH_API_URL || 'http://localhost/workpulse_api/auth.php';
const USE_EXTERNAL_AUTH = process.env.USE_EXTERNAL_AUTH === 'true'; // Feature Flag for External Auth

exports.signup = (req, res) => {
    // Save User to Database
    TblStaff.create({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        password: bcrypt.hashSync(req.body.password, 8),
        datecreated: new Date(),
        role: req.body.role ? req.body.role : 1, // Default role 1 (employee)
        active: 1
    })
        .then(user => {
            res.send({ message: "User was registered successfully!" });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.signin = async (req, res) => {
    console.log("Signin request received for:", req.body.email);

    // --- PHP AUTHENTICATION & SYNC ---
    let phpAuthSuccess = false;
    let phpUserData = null;

    if (USE_EXTERNAL_AUTH) {
        try {
            console.log("Attempting PHP Auth at:", PHP_AUTH_API_URL);
            const phpResponse = await axios.post(PHP_AUTH_API_URL, {
                email: req.body.email,
                password: req.body.password
            }, { timeout: 5000 }); // 5s timeout

            if (phpResponse.data && phpResponse.data.success) {
                console.log("✅ PHP Auth Successful");
                phpAuthSuccess = true;
                phpUserData = phpResponse.data.data;
            }
        } catch (err) {
            console.log("⚠️ PHP Auth skipped/failed (will try local):", err.message);
        }
    } else {
        console.log("ℹ️ External Auth Disabled. Using local WorkPulse DB.");
    }
    // ----------------------------------

    try {
        let user = await TblStaff.findOne({
            where: {
                email: req.body.email
            }
        });

        // If PHP Auth succeeded, SYNC the user to local DB
        if (phpAuthSuccess && phpUserData) {
            const hashedPassword = bcrypt.hashSync(req.body.password, 8);

            // Prepare basic user data to sync (excluding role/admin as they are managed locally)
            const userDataToSync = {
                firstname: phpUserData.firstname,
                lastname: phpUserData.lastname,
                gender: phpUserData.gender,
                active: phpUserData.active !== undefined ? phpUserData.active : 1,
                password: hashedPassword, // Sync password for future fallback
            };

            if (user) {
                console.log("Syncing existing user from PHP data (excluding role/admin)...");
                await user.update(userDataToSync);
            } else {
                console.log("Creating new user from PHP data...");
                // For new users, keep role and admin empty (null/0)
                user = await TblStaff.create({
                    email: req.body.email,
                    ...userDataToSync,
                    role: null,
                    admin: 0,
                    datecreated: new Date()
                });
            }
        }

        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).send({ message: "Your account is inactive. Please contact your administrator." });
        }

        // Verify Password ONLY if PHP auth didn't already verify it
        if (!phpAuthSuccess) {
            var passwordIsValid = bcrypt.compareSync(
                req.body.password,
                user.password
            );

            if (!passwordIsValid) {
                return res.status(401).send({
                    accessToken: null,
                    message: "Invalid Password!"
                });
            }
        }

        var token = jwt.sign({ id: user.staffid }, config.JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });

        // Log activity
        await logActivity({
            admin_id: user.staffid,
            action: 'LOGIN',
            entity: 'User',
            entity_id: user.staffid,
            affected_user_id: user.staffid,
            description: `${user.firstname} ${user.lastname} logged in${phpAuthSuccess ? ' (via PHP Auth)' : ''}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            id: user.staffid,
            staffid: user.staffid,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            accessToken: token
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

exports.logout = async (req, res) => {
    try {
        const userId = req.userId; // From authJwt middleware
        const user = await TblStaff.findOne({
            where: {
                staffid: userId
            }
        });

        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }

        // Log activity
        await logActivity({
            admin_id: userId,
            action: 'LOGOUT',
            entity: 'User',
            entity_id: userId,
            affected_user_id: userId,
            description: `${user.firstname} ${user.lastname} logged out`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: "User logged out successfully"
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

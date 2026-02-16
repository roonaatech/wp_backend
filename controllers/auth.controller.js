const db = require("../models");
const config = process.env;
const TblStaff = db.user;
const axios = require('axios'); // For PHP API
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const apkController = require("./apk.controller");

const PHP_AUTH_BASE_URL = process.env.PHP_AUTH_BASE_URL || 'http://dev-abis.roonaa.in:8553';
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
    const { email, password, forceLocal, is_mobile_app, app_version } = req.body;
    console.log("Signin request received for:", email, forceLocal ? "(Force Local)" : "", is_mobile_app ? `(Mobile App v${app_version})` : "");

    // --- APP VERSION CHECK FOR MOBILE APP ---
    if (is_mobile_app && app_version) {
        try {
            const versionCheck = await apkController.isVersionOutdated(app_version);
            if (versionCheck.outdated) {
                console.log(`⚠️ Mobile app version ${app_version} is outdated. Latest: ${versionCheck.latestVersion}`);
                return res.status(426).send({
                    updateRequired: true,
                    currentVersion: versionCheck.currentVersion,
                    latestVersion: versionCheck.latestVersion,
                    releaseNotes: versionCheck.releaseNotes,
                    downloadUrl: versionCheck.downloadUrl,
                    message: `Your app version (${app_version}) is outdated. Please update to version ${versionCheck.latestVersion} to continue.`
                });
            }
        } catch (versionErr) {
            console.log("⚠️ Version check failed:", versionErr.message);
            // Continue with login if version check fails (don't block users)
        }
    }

    // --- PHP AUTHENTICATION & SYNC ---
    let phpAuthSuccess = false;
    let phpUserData = null;

    if (USE_EXTERNAL_AUTH && !forceLocal) {
        try {
            console.log("Attempting PHP Auth Step 1 (CSRF) at:", `${PHP_AUTH_BASE_URL}/ext-auth/get_csrf_hash`);

            // 1. Get CSRF Token
            const csrfResponse = await axios.get(`${PHP_AUTH_BASE_URL}/ext-auth/get_csrf_hash`, { timeout: 5000 });
            const { csrfName, csrfHash } = csrfResponse.data;
            const cookies = csrfResponse.headers['set-cookie'];

            if (csrfName && csrfHash) {
                // 2. Login with Token
                console.log("Attempting PHP Auth Step 2 (Login)...");

                // Format payload as x-www-form-urlencoded (Required for CodeIgniter/PHP defaults)
                const params = new URLSearchParams();
                params.append('email', email);
                params.append('password', password);
                params.append(csrfName, csrfHash);

                // Format Headers and Cookies
                const loginHeaders = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': "WorkPulse-Backend/1.0" // Sometimes required by firewalls
                };

                if (cookies) {
                    // Extract key=value from set-cookie array (removing path, httponly, etc)
                    loginHeaders['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
                }

                console.log("Debug - Headers:", JSON.stringify(loginHeaders));

                const phpResponse = await axios.post(`${PHP_AUTH_BASE_URL}/ext-auth/login`, params, {
                    headers: loginHeaders,
                    timeout: 5000
                });

                if (phpResponse.data && phpResponse.data.success) {
                    console.log("✅ PHP Auth Successful");
                    phpAuthSuccess = true;
                    phpUserData = phpResponse.data.data;
                } else {
                    console.log("⚠️ PHP Login Failed (Invalid Credentials or API Error)");
                }
            } else {
                console.log("⚠️ CSRF Token retrieval failed (Format mismatch)");
            }
        } catch (err) {
            console.log("⚠️ PHP Auth failed:", err.message);
            // If PHP auth fails (e.g. timeout, connection refused), ask user for confirmation
            // unless forceLocal is already true
            return res.status(200).send({
                requiresConfirmation: true,
                message: "External authentication system is unreachable. Do you want to continue with local authentication?"
            });
        }
    } else {
        if (forceLocal) {
            console.log("ℹ️ Force Local Auth requested.");
        } else {
            console.log("ℹ️ External Auth Disabled. Using local WorkPulse DB.");
        }
    }
    // ----------------------------------

    try {
        let user = null;

        // 1. If PHP Auth succeeded, try to find user by External ID (userid)
        if (phpAuthSuccess && phpUserData) {
            user = await TblStaff.findOne({
                where: {
                    userid: phpUserData.staffid
                }
            });

            // If we found the user by userid, we are Good. We will update them below.
            if (user) {
                console.log("Found user by External ID (userid):", user.staffid);
            }
        }

        // 2. If user not found yet (Local Auth, or First-time Sync where userid is null), find by Email
        if (!user) {
            user = await TblStaff.findOne({
                where: {
                    email: req.body.email
                }
            });
        }

        let isNewUser = false; // Flag to track first-time login via sync

        // If PHP Auth succeeded, SYNC the user to local DB
        if (phpAuthSuccess && phpUserData) {
            const hashedPassword = bcrypt.hashSync(req.body.password, 8);

            // Prepare basic user data to sync (excluding role/admin as they are managed locally)
            const userDataToSync = {
                userid: phpUserData.staffid, // Map external staffid to local userid
                firstname: phpUserData.firstname,
                lastname: phpUserData.lastname,
                // gender: phpUserData.gender,      <-- Excluded from sync as per requirement
                active: phpUserData.active !== undefined ? parseInt(phpUserData.active) : 1, // Ensure integer
                password: hashedPassword, // Sync password for future fallback
            };

            if (user) {
                console.log("Syncing existing user from PHP data...");
                await user.update(userDataToSync);
            } else {
                console.log("Creating new user from PHP data...");
                // For new users, keep role and admin empty (null/0)
                user = await TblStaff.create({
                    email: req.body.email,
                    ...userDataToSync,
                    gender: null, // Initialize as empty/null so Admin can set it later
                    role: null,
                    admin: 0,
                    datecreated: new Date()
                });
                isNewUser = true; // Mark as first-time login
            }
        }

        if (!user) {
            return res.status(404).send({ message: "User Not found." });
        }

        // Ensure robust check for inactive status (handle 0, "0", false)
        if (user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({ message: "Your account is inactive. Please contact your administrator." });
        }

        // Check for Web App Access Permission
        // Only if it is NOT a mobile app login
        if (user.role && req.body.is_mobile_app !== true) {
            const Role = db.roles;
            const userRole = await Role.findByPk(user.role);
            if (userRole && userRole.can_access_webapp !== true) {
                return res.status(403).send({ message: "Access denied. You do not have permission to access the web application." });
            }
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
            userid: user.userid, // Include userid to check if WorkPulse-only user (null) or external (not null)
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            gender: user.gender, // Include gender for frontend checks
            isFirstLogin: isNewUser, // Return flag to frontend
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

exports.changePassword = async (req, res) => {
    try {
        const userId = req.userId; // From authJwt middleware
        const { oldPassword, newPassword } = req.body;

        // Validate input
        if (!oldPassword || !newPassword) {
            return res.status(400).send({ message: "Old password and new password are required." });
        }

        if (newPassword.length < 6) {
            return res.status(400).send({ message: "New password must be at least 6 characters long." });
        }

        // Find user
        const user = await TblStaff.findOne({
            where: {
                staffid: userId
            }
        });

        if (!user) {
            return res.status(404).send({ message: "User not found." });
        }

        // Check if user is WorkPulse-only (not synced from PHP app)
        if (user.userid !== null) {
            return res.status(403).send({
                message: "Password change is not allowed for users synced from the external system. Please use the main application to change your password."
            });
        }

        // Verify old password
        const passwordIsValid = bcrypt.compareSync(oldPassword, user.password);
        if (!passwordIsValid) {
            return res.status(401).send({ message: "Current password is incorrect." });
        }

        // Check if new password is same as old password
        const isSamePassword = bcrypt.compareSync(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).send({ message: "New password must be different from current password." });
        }

        // Hash and update new password
        const hashedPassword = bcrypt.hashSync(newPassword, 8);
        await user.update({ password: hashedPassword });

        // Log activity
        await logActivity({
            admin_id: userId,
            action: 'PASSWORD_CHANGE',
            entity: 'User',
            entity_id: userId,
            affected_user_id: userId,
            description: `${user.firstname} ${user.lastname} changed their password`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: "Password changed successfully!"
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

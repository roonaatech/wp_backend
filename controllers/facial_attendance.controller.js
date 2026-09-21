const db = require("../models");
const User = db.user;
const Role = db.roles;
const EmployeeProfile = db.employee_profiles;
const AttendanceLog = db.attendance_logs;
const Approval = db.approvals;
const Setting = db.settings;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const timezoneUtil = require("../utils/timezone.util");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const faceBiometrics = require("../services/face_biometrics.service");
const badgeSecurity = require("../services/badge_security.service");

// Helper to get application timezone
const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

// Calculate Euclidean distance between two descriptor arrays
const getEuclideanDistance = (arr1, arr2) => {
    return faceBiometrics.getEuclideanDistance(arr1, arr2);
};

/**
 * Register employee face descriptor and optional photo
 * POST /api/attendance/register-face (Self-service)
 * POST /api/admin/users/:id/register-face (Admin/HR)
 */
exports.registerFace = async (req, res) => {
    const userId = req.params.id || req.userId;
    let { faceDescriptor, faceDescriptorLeft, faceDescriptorRight, profileImage, imageLeft, imageRight } = req.body;

    try {
        // Server-side descriptor extraction if raw images are provided
        if ((!faceDescriptor || !Array.isArray(faceDescriptor)) && profileImage) {
            const extracted = await faceBiometrics.extractDescriptor(profileImage);
            if (!extracted) {
                return res.status(400).send({ message: "No face detected in the front profile image." });
            }
            faceDescriptor = extracted.descriptor;
        }

        if ((!faceDescriptorLeft || !Array.isArray(faceDescriptorLeft)) && imageLeft) {
            const extractedLeft = await faceBiometrics.extractDescriptor(imageLeft);
            if (extractedLeft) faceDescriptorLeft = extractedLeft.descriptor;
        }

        if ((!faceDescriptorRight || !Array.isArray(faceDescriptorRight)) && imageRight) {
            const extractedRight = await faceBiometrics.extractDescriptor(imageRight);
            if (extractedRight) faceDescriptorRight = extractedRight.descriptor;
        }

        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
            return res.status(400).send({
                message: "A valid 128-dimensional face descriptor or front profile image is required."
            });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        // Prevent the same face from being registered for more than one employee.
        // Compare the incoming descriptor against every OTHER user's registered face.
        const DUPLICATE_THRESHOLD = 0.45;
        const otherUsers = await User.findAll({
            where: {
                staffid: { [db.Sequelize.Op.ne]: user.staffid },
                face_descriptor: { [db.Sequelize.Op.ne]: null }
            },
            attributes: ['staffid', 'firstname', 'lastname', 'face_descriptor']
        });

        for (const other of otherUsers) {
            let existingDescriptor;
            try {
                existingDescriptor = JSON.parse(other.face_descriptor);
            } catch {
                continue; // skip malformed stored descriptors
            }
            const distance = getEuclideanDistance(faceDescriptor, existingDescriptor);
            if (distance < DUPLICATE_THRESHOLD) {
                return res.status(409).send({
                    message: `This face is already registered to ${other.firstname} ${other.lastname}. A face can only be registered for one employee.`
                });
            }
        }

        const updates = {
            face_descriptor: JSON.stringify(faceDescriptor),
            face_registered_at: new Date()
        };

        if (faceDescriptorLeft) {
            updates.face_descriptor_left = JSON.stringify(faceDescriptorLeft);
        }
        if (faceDescriptorRight) {
            updates.face_descriptor_right = JSON.stringify(faceDescriptorRight);
        }

        // Save the face capture as a separate image, keeping the existing profile photo intact
        if (profileImage && profileImage.startsWith("data:image")) {
            const dir = "uploads/faces";
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const base64Data = profileImage.replace(/^data:image\/\w+;base64,/, "");
            const ext = profileImage.substring(profileImage.indexOf("/") + 1, profileImage.indexOf(";"));
            const filename = `face-${userId}-${Date.now()}.${ext}`;
            const imagePath = path.join(dir, filename);

            fs.writeFileSync(imagePath, base64Data, "base64");

            // Store the face image path on the user; do NOT overwrite the profile photo
            updates.face_image_path = imagePath;
        }

        // Update face descriptor, timestamp, and (optionally) face image path
        await user.update(updates);

        // Log action
        await logActivity({
            admin_id: req.userId,
            action: 'REGISTER_FACE',
            entity: 'User',
            entity_id: userId,
            affected_user_id: userId,
            description: `Registered face verification template for employee: ${user.firstname} ${user.lastname}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: "Face registration completed successfully."
        });
    } catch (err) {
        console.error("Error registering face:", err);
        res.status(500).send({ message: err.message || "Error occurred while registering face." });
    }
};

/**
 * Remove employee face descriptor and stored face photo
 * DELETE /api/admin/users/:id/face (Admin and above)
 */
exports.removeFace = async (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send({ message: "User ID parameter is required." });
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        // Hierarchy & Permission validation:
        // Super Admin (level 0) can remove anyone's face.
        // Other authorized roles (governed by remove_face_roles setting) can remove anyone
        // whose hierarchy level is equal or greater (cannot remove higher authority).
        const callerRole = req.callerRole || (req.userId ? await Role.findByPk((await User.findByPk(req.userId))?.role) : null);
        const targetUserRole = user.role ? await Role.findByPk(user.role) : null;

        if (!callerRole) {
            return res.status(403).send({ message: "Unable to validate caller role." });
        }

        const setting = await db.settings.findOne({ where: { key: 'remove_face_roles' } });
        if (setting && setting.value !== null && setting.value !== undefined && setting.value.trim() !== '') {
            const allowedRoleIds = setting.value.split(',').map(s => s.trim()).filter(Boolean);
            if (!allowedRoleIds.includes(String(callerRole.id))) {
                return res.status(403).send({ message: "Your role is not authorized to remove user face data." });
            }
        } else if (callerRole.hierarchy_level === null || callerRole.hierarchy_level === undefined || callerRole.hierarchy_level > 1) {
            return res.status(403).send({ message: "Only Admin and Super Admin roles can remove user face data." });
        }

        if (callerRole.hierarchy_level > 0 && targetUserRole && targetUserRole.hierarchy_level < callerRole.hierarchy_level) {
            return res.status(403).send({
                message: `You don't have permission to remove face data for users with ${targetUserRole.display_name || targetUserRole.name} role.`
            });
        }

        // Delete face image file from disk if it exists
        if (user.face_image_path) {
            try {
                if (fs.existsSync(user.face_image_path)) {
                    fs.unlinkSync(user.face_image_path);
                }
            } catch (fileErr) {
                console.warn("Could not delete face image file:", fileErr.message);
            }
        }

        // Reset face fields in database
        await user.update({
            face_descriptor: null,
            face_descriptor_left: null,
            face_descriptor_right: null,
            face_image_path: null,
            face_registered_at: null
        });

        // Log audit activity
        await logActivity({
            admin_id: req.userId,
            action: 'REMOVE_FACE',
            entity: 'User',
            entity_id: userId,
            affected_user_id: userId,
            description: `Removed biometric face data and image for employee: ${user.firstname} ${user.lastname}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: `Face ID for ${user.firstname} ${user.lastname} has been removed successfully.`
        });
    } catch (err) {
        console.error("Error removing face data:", err);
        res.status(500).send({ message: err.message || "Error occurred while removing face data." });
    }
};

/**
 * Get face registration status of current authenticated user
 * GET /api/attendance/face-status
 */
exports.getFaceStatus = async (req, res) => {
    try {
        if (req.isServiceAccount) {
            const account = await db.service_accounts.findByPk(req.userId);
            if (!account) {
                return res.status(404).send({ message: "Service account not found." });
            }

            let canAccessAttendancePortal = false;
            if (account.role_id) {
                const role = await Role.findByPk(account.role_id);
                if (role && (role.can_access_attendance_portal == true || role.can_access_attendance_portal === true)) {
                    canAccessAttendancePortal = true;
                }
            }

            return res.status(200).send({
                isRegistered: false,
                registeredAt: null,
                faceImagePath: null,
                isServiceAccount: true,
                can_access_attendance_portal: canAccessAttendancePortal
            });
        }

        const user = await User.findByPk(req.userId, {
            attributes: ['staffid', 'role', 'face_descriptor', 'face_registered_at', 'face_image_path']
        });

        if (!user) {
            return res.status(404).send({ message: "User not found." });
        }

        let canAccessAttendancePortal = false;
        if (user.role) {
            const role = await Role.findByPk(user.role);
            if (role && (role.can_access_attendance_portal == true || role.can_access_attendance_portal === true)) {
                canAccessAttendancePortal = true;
            }
        }

        const isRegistered = !!(user.face_descriptor && user.face_descriptor.length > 0);
        res.status(200).send({
            isRegistered,
            registeredAt: user.face_registered_at,
            faceImagePath: user.face_image_path ? user.face_image_path.replace(/\\/g, '/') : null,
            can_access_attendance_portal: canAccessAttendancePortal
        });
    } catch (err) {
        console.error("Error checking face status:", err);
        res.status(500).send({ message: err.message || "Failed to check face status." });
    }
};

/**
 * Identify an employee by face image or descriptor (auto-fill / auto-identify)
 * POST /api/attendance/identify-face
 * Returns: { matched: true, email, employeeName, distance } or { matched: false }
 */
exports.identifyFace = async (req, res) => {
    try {
        const { faceDescriptor, image, snapshotImage } = req.body;
        const rawImage = image || snapshotImage;

        if ((!faceDescriptor || !Array.isArray(faceDescriptor)) && !rawImage) {
            return res.status(400).send({ matched: false, message: "Face snapshot image or descriptor is required." });
        }

        // Fetch all active users with registered face descriptors
        const users = await User.findAll({
            where: {
                active: true,
                face_descriptor: { [db.Sequelize.Op.ne]: null }
            },
            attributes: ['staffid', 'email', 'firstname', 'lastname', 'face_descriptor']
        });

        if (!users || users.length === 0) {
            return res.status(200).send({ matched: false, message: "No registered faces found." });
        }

        const result = await faceBiometrics.identifyEmployee(faceDescriptor || rawImage, users, {
            threshold: 0.45,
            margin: 0.03
        });

        if (result.matched && result.user) {
            return res.status(200).send({
                matched: true,
                email: result.user.email,
                employeeName: `${result.user.firstname} ${result.user.lastname}`,
                distance: result.distance,
                descriptor: result.descriptor
            });
        }

        return res.status(200).send({
            matched: false,
            message: result.message || "Face not recognized.",
            distance: result.closestDistance
        });

    } catch (err) {
        console.error("Error identifying face:", err);
        res.status(500).send({ matched: false, message: err.message || "Error identifying face." });
    }
};

/**
 * Check an employee's current attendance status for today
 * GET /api/attendance/status/:email
 * Returns: { status: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED' }
 */
exports.getAttendanceStatus = async (req, res) => {
    try {
        const { email } = req.params;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            // Check if this is a registered service account (terminal / kiosk)
            const serviceAccount = await db.service_accounts.findOne({ where: { email } });
            if (serviceAccount) {
                return res.status(200).send({
                    status: 'TERMINAL',
                    employeeName: serviceAccount.name,
                    isServiceAccount: true
                });
            }
            return res.status(404).send({ message: "Employee not found." });
        }

        const tz = await getAppTimezone();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        // Check for an open check-in (no checkout yet)
        const openLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null
            }
        });

        if (openLog) {
            const checkInFormatted = formatDateInTimezone(openLog.check_in_time, tz);
            return res.status(200).send({ 
                status: 'CHECKED_IN', 
                employeeName: `${user.firstname} ${user.lastname}`,
                checkInTime: checkInFormatted,
                checkInRaw: openLog.check_in_time
            });
        }

        // Check for a completed session today
        const completedLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: { [db.Sequelize.Op.ne]: null }
            }
        });

        if (completedLog) {
            return res.status(200).send({ status: 'COMPLETED', employeeName: `${user.firstname} ${user.lastname}` });
        }

        return res.status(200).send({ status: 'NOT_CHECKED_IN', employeeName: `${user.firstname} ${user.lastname}` });

    } catch (err) {
        console.error("Error checking attendance status:", err);
        res.status(500).send({ message: err.message || "Error checking attendance status." });
    }
};

/**
 * Perform combined credentials and facial match check-in or check-out
 * POST /api/attendance/check-in-out-with-face
 */
exports.checkInOutWithFace = async (req, res) => {
    let { email, password, faceDescriptor, faceDescriptorLeft, faceDescriptorRight, snapshotImage, image, imageLeft, imageRight, latitude, longitude, phone_model, action, livenessVerified } = req.body;
    const rawImage = snapshotImage || image;

    if (!email || (!password && !livenessVerified)) {
        return res.status(400).send({
            message: "Email and password/liveness are required."
        });
    }

    if (!action || !['CHECK_IN', 'CHECK_OUT'].includes(action)) {
        return res.status(400).send({
            message: "Action must be either 'CHECK_IN' or 'CHECK_OUT'."
        });
    }

    try {
        // Server-side descriptor extraction from snapshot if not already supplied
        if ((!faceDescriptor || !Array.isArray(faceDescriptor)) && rawImage) {
            const extracted = await faceBiometrics.extractDescriptor(rawImage);
            if (!extracted) {
                return res.status(400).send({
                    success: false,
                    message: "No face detected in the attendance snapshot."
                });
            }
            faceDescriptor = extracted.descriptor;
        }

        if ((!faceDescriptorLeft || !Array.isArray(faceDescriptorLeft)) && imageLeft) {
            const extractedLeft = await faceBiometrics.extractDescriptor(imageLeft);
            if (extractedLeft) faceDescriptorLeft = extractedLeft.descriptor;
        }

        if ((!faceDescriptorRight || !Array.isArray(faceDescriptorRight)) && imageRight) {
            const extractedRight = await faceBiometrics.extractDescriptor(imageRight);
            if (extractedRight) faceDescriptorRight = extractedRight.descriptor;
        }

        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
            return res.status(400).send({
                message: "A valid face descriptor or camera snapshot image is required."
            });
        }

        // 1. Authenticate password
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        if (user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({ message: "Account is inactive. Please contact administrator." });
        }

        if (!livenessVerified) {
            const passwordIsValid = bcrypt.compareSync(password, user.password);
            if (!passwordIsValid) {
                return res.status(400).send({ message: "Invalid Password!" });
            }
        }

        // 2. Fetch stored descriptor
        if (!user.face_descriptor) {
            return res.status(400).send({
                message: "Face ID is not registered for this employee. Please register first."
            });
        }

        const storedDescriptor = JSON.parse(user.face_descriptor);
        
        // 3. Compute Euclidean Distance
        const distance = getEuclideanDistance(faceDescriptor, storedDescriptor);
        const threshold = 0.6; // Default face-api.js threshold

        if (distance >= threshold) {
            return res.status(400).send({
                success: false,
                distance,
                message: "Facial verification failed. Face does not match the registered user."
            });
        }

        // Profile descriptors verification (with angle tolerance & cross-mirror matching)
        const PROFILE_THRESHOLD = 0.72;
        let storedLeft = null;
        let storedRight = null;
        try {
            if (user.face_descriptor_left) storedLeft = JSON.parse(user.face_descriptor_left);
            if (user.face_descriptor_right) storedRight = JSON.parse(user.face_descriptor_right);
        } catch (_) {}

        // Collect all reference descriptors for this user
        const allUserDescriptors = [storedDescriptor];
        if (storedLeft) allUserDescriptors.push(storedLeft);
        if (storedRight) allUserDescriptors.push(storedRight);

        // Compare Left Profile if provided and registered
        if (faceDescriptorLeft && (storedLeft || storedRight)) {
            try {
                const minLeftDistance = Math.min(...allUserDescriptors.map(d => getEuclideanDistance(faceDescriptorLeft, d)));
                if (minLeftDistance >= PROFILE_THRESHOLD) {
                    return res.status(400).send({
                        success: false,
                        distance: minLeftDistance,
                        message: "Left profile verification failed. Face does not match registered profile."
                    });
                }
            } catch (err) {
                // ignore parsing error
            }
        }

        // Compare Right Profile if provided and registered
        if (faceDescriptorRight && (storedLeft || storedRight)) {
            try {
                const minRightDistance = Math.min(...allUserDescriptors.map(d => getEuclideanDistance(faceDescriptorRight, d)));
                if (minRightDistance >= PROFILE_THRESHOLD) {
                    return res.status(400).send({
                        success: false,
                        distance: minRightDistance,
                        message: "Right profile verification failed. Face does not match registered profile."
                    });
                }
            } catch (err) {
                // ignore parsing error
            }
        }

        // 4. Face matches! Process the requested action
        const tz = await getAppTimezone();
        const now = new Date();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        // Save verification snapshot if provided (useful for auditing)
        let snapshotPath = null;
        if (snapshotImage && snapshotImage.startsWith("data:image")) {
            const dir = "uploads/attendance_snapshots";
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const base64Data = snapshotImage.replace(/^data:image\/\w+;base64,/, "");
            const ext = snapshotImage.substring(snapshotImage.indexOf("/") + 1, snapshotImage.indexOf(";"));
            filename = `snapshot-${user.staffid}-${Date.now()}.${ext}`;
            snapshotPath = path.join(dir, filename);
            fs.writeFileSync(snapshotPath, base64Data, "base64");
        }

        let logDetails = null;

        if (action === 'CHECK_IN') {
            // Verify employee is NOT already checked in today
            const existingOpenLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: null
                }
            });

            if (existingOpenLog) {
                return res.status(400).send({
                    success: false,
                    message: "You are already checked in. Please check out first before checking in again."
                });
            }

            // Also check if a completed session exists today
            const completedLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: { [db.Sequelize.Op.ne]: null }
                }
            });

            if (completedLog) {
                return res.status(400).send({
                    success: false,
                    message: "Check-in can be done once per day. You have already completed attendance for today."
                });
            }

            // Create check-in record
            const attendance = {
                staff_id: user.staffid,
                check_in_time: now,
                date: todayDateOnly,
                phone_model: phone_model || 'Front Desk Web Camera',
                ip_address: getClientIp(req),
                latitude: latitude || null,
                longitude: longitude || null
            };

            logDetails = await AttendanceLog.create(attendance);

        } else {
            // CHECK_OUT: Find the open check-in record for today
            const existingLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: null
                },
                order: [['check_in_time', 'DESC']]
            });

            if (!existingLog) {
                return res.status(400).send({
                    success: false,
                    message: "No active check-in found. Please check in first before checking out."
                });
            }

            await existingLog.update({
                check_out_time: now
            });
            logDetails = existingLog;

            // Auto-trigger approval if manager exists
            if (user.approving_manager_id) {
                await Approval.create({
                    attendance_log_id: existingLog.id,
                    manager_id: user.approving_manager_id,
                    status: 'pending'
                });
            }
        }

        // Log Activity log
        await logActivity({
            admin_id: user.staffid,
            action: action,
            entity: 'AttendanceLog',
            entity_id: logDetails.id,
            affected_user_id: user.staffid,
            description: `Facial Attendance ${action === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} successful (Distance: ${distance.toFixed(4)})`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            type: action,
            employeeName: `${user.firstname} ${user.lastname}`,
            time: nowString,
            distance,
            message: `${action === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded successfully.`
        });

    } catch (err) {
        console.error("Error in facial attendance validation:", err);
        res.status(500).send({ message: err.message || "Internal server error occurred." });
    }
};

// Helper to format Date in app timezone as YYYY-MM-DD HH:mm:ss
const formatDateInTimezone = (dateObj, tz) => {
    if (!dateObj) return null;
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(new Date(dateObj));
        const p = {};
        parts.forEach(part => { p[part.type] = part.value; });
        return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
    } catch (e) {
        return String(dateObj);
    }
};

/**
 * Get detailed attendance logs for reports
 * GET /api/admin/attendance-logs
 */
exports.getAttendanceLogsReport = async (req, res) => {
    try {
        const { Op } = require("sequelize");
        const Role = db.roles;
        const tz = await getAppTimezone();

        // 1. Scoping & Permissions Check
        const currentUser = await User.findByPk(req.userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        const canViewAllReports = userRole && userRole.can_view_reports === 'all';
        const canViewSubordinateReports = userRole && (userRole.can_view_reports === 'subordinates' || userRole.can_view_reports === 'all');

        let allowedStaffIds = [];
        if (!canViewAllReports && canViewSubordinateReports) {
            const reportees = await User.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            allowedStaffIds = reportees.map(r => r.staffid);
            // Include self in subordinate reports view
            allowedStaffIds.push(req.userId);
        } else if (!canViewAllReports && !canViewSubordinateReports) {
            // Self-only view
            allowedStaffIds = [req.userId];
        }

        // 2. Query filters
        const { page = 1, limit = 10, userId, startDate, endDate, status } = req.query;
        const limitVal = parseInt(limit);
        const offsetVal = (parseInt(page) - 1) * limitVal;

        const whereClause = {};

        // Scope filter
        if (!canViewAllReports) {
            whereClause.staff_id = { [Op.in]: allowedStaffIds };
        }

        // Specific employee filter
        if (userId) {
            const targetUserId = parseInt(userId);
            if (!canViewAllReports && !allowedStaffIds.includes(targetUserId)) {
                return res.status(403).send({ message: "Access denied to target employee details." });
            }
            whereClause.staff_id = targetUserId;
        }

        // Date range filter
        if (startDate && endDate) {
            whereClause.date = { [Op.between]: [startDate, endDate] };
        } else if (startDate) {
            whereClause.date = { [Op.gte]: startDate };
        } else if (endDate) {
            whereClause.date = { [Op.lte]: endDate };
        }

        // Build Approval Status Join & Filter
        const approvalInclude = {
            model: Approval,
            as: "approval",
            required: false
        };

        if (status && status !== 'all') {
            approvalInclude.where = { status };
            approvalInclude.required = true; // Only return records that have matching approval status
        }

        // 3. Query
        const { count, rows } = await AttendanceLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    attributes: ['firstname', 'lastname', 'email'],
                    include: [
                        {
                            model: EmployeeProfile,
                            attributes: ['image_path'],
                            as: 'profile_info'
                        }
                    ],
                    as: 'user'
                },
                approvalInclude
            ],
            order: [['date', 'DESC'], ['check_in_time', 'DESC']],
            limit: limitVal,
            offset: offsetVal
        });

        // Format dates & snapshots
        const reportsList = rows.map(item => {
            const plain = item.get({ plain: true });
            
            // Format times to target timezone
            plain.check_in_time = formatDateInTimezone(plain.check_in_time, tz);
            plain.check_out_time = formatDateInTimezone(plain.check_out_time, tz);
            
            // Format snapshot path for client consumption
            if (plain.snapshot_path) {
                // Serve via direct URL
                plain.snapshot_url = plain.snapshot_path.replace(/\\/g, '/');
            }

            return plain;
        });

        res.status(200).send({
            totalItems: count,
            totalPages: Math.ceil(count / limitVal),
            currentPage: parseInt(page),
            reports: reportsList
        });

    } catch (err) {
        console.error("Error in getAttendanceLogsReport:", err);
        res.status(500).send({ message: err.message || "Failed to fetch attendance reports." });
    }
};

/**
 * Update an attendance log's check-out time (e.g. to close out a forgotten
 * checkout, or correct it). Date and check-in time are captured via facial
 * recognition and are immutable - they are intentionally ignored here even
 * if present in the request body, so this cannot be used to alter the
 * biometrically verified check-in record.
 * PUT /api/admin/attendance-logs/:id
 */
exports.updateAttendanceLog = async (req, res) => {
    try {
        const { check_out_time } = req.body;
        const logId = req.params.id;

        const log = await AttendanceLog.findByPk(logId, {
            include: [{ model: User, as: 'user' }]
        });

        if (!log) {
            return res.status(404).send({ message: "Attendance log not found." });
        }

        const oldValues = {
            check_out_time: log.check_out_time
        };

        const tz = await getAppTimezone();

        const updateData = {};

        // Parse the checkout string if provided. It represents wall-clock
        // time in the app's configured timezone, not the server's local
        // timezone, so it must be converted explicitly rather than passed
        // through `new Date(str)` (which parses using the server's local tz).
        if (check_out_time) {
            updateData.check_out_time = timezoneUtil.parseTimeInTimezone(check_out_time, tz);
        } else if (check_out_time === null || check_out_time === "") {
            updateData.check_out_time = null;
        }

        // Reject future check-out times
        const now = new Date();
        if (updateData.check_out_time && updateData.check_out_time.getTime() > now.getTime()) {
            return res.status(400).send({ message: "Check-out time cannot be in the future." });
        }

        await log.update(updateData);

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: 'UPDATE',
            entity: 'AttendanceLog',
            entity_id: log.id,
            affected_user_id: log.staff_id,
            description: `Manually updated attendance log for employee ${log.user?.firstname} ${log.user?.lastname}`,
            old_values: oldValues,
            new_values: updateData,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: "Attendance log updated successfully.",
            log
        });

    } catch (err) {
        console.error("Error updating attendance log:", err);
        res.status(500).send({ message: err.message || "Failed to update attendance log." });
    }
};

/**
 * Delete an attendance log record
 * DELETE /api/admin/attendance-logs/:id
 */
exports.deleteAttendanceLog = async (req, res) => {
    try {
        const logId = req.params.id;

        const log = await AttendanceLog.findByPk(logId, {
            include: [{ model: User, as: 'user' }]
        });

        if (!log) {
            return res.status(404).send({ message: "Attendance log not found." });
        }

        // Snapshot the record before deletion so the audit trail preserves what was removed
        const deletedValues = {
            date: log.date,
            check_in_time: log.check_in_time,
            check_out_time: log.check_out_time
        };

        // Delete associated approval records first
        await Approval.destroy({
            where: { attendance_log_id: logId }
        });

        await log.destroy();

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: 'DELETE',
            entity: 'AttendanceLog',
            entity_id: logId,
            affected_user_id: log.staff_id,
            description: `Deleted attendance log for employee ${log.user?.firstname} ${log.user?.lastname} on ${log.date}`,
            old_values: deletedValues,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(200).send({
            success: true,
            message: "Attendance log deleted successfully."
        });

    } catch (err) {
        console.error("Error deleting attendance log:", err);
        res.status(500).send({ message: err.message || "Failed to delete attendance log." });
    }
};

/**
 * Fetch staff list for mobile / kiosk attendance terminal
 * GET /api/attendance/staff-list
 */
exports.getStaffList = async (req, res) => {
    try {
        const users = await User.findAll({
            where: { active: 1 },
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role', 'face_descriptor'],
            include: [
                {
                    model: Role,
                    as: 'role_info',
                    attributes: ['id', 'name', 'display_name'],
                    required: false
                }
            ],
            order: [['firstname', 'ASC'], ['lastname', 'ASC']]
        });

        const staff = users.map(u => ({
            staffid: u.staffid,
            firstname: u.firstname,
            lastname: u.lastname,
            name: `${u.firstname} ${u.lastname}`.trim(),
            email: u.email,
            roleName: u.role_info?.display_name || u.role_info?.name || 'Employee',
            hasFaceRegistered: !!(u.face_descriptor && u.face_descriptor.length > 0)
        }));

        res.status(200).send(staff);
    } catch (err) {
        console.error("Error fetching staff list for kiosk:", err);
        res.status(500).send({ message: err.message || "Failed to fetch staff list." });
    }
};

/**
 * Record Kiosk / Mobile Terminal attendance for an employee
 * POST /api/attendance/kiosk-record
 */
exports.recordKioskAttendance = async (req, res) => {
    const { email, action, latitude, longitude, phone_model } = req.body;

    if (!email || !action || !['CHECK_IN', 'CHECK_OUT'].includes(action)) {
        return res.status(400).send({
            message: "Email and valid action ('CHECK_IN' or 'CHECK_OUT') are required."
        });
    }

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        if (user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({ message: "Employee account is inactive." });
        }

        const tz = await getAppTimezone();
        const now = new Date();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];
        const formattedNowTime = formatDateInTimezone(now, tz);

        if (action === 'CHECK_IN') {
            // Verify employee is NOT already checked in today
            const existingOpenLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: null
                }
            });

            if (existingOpenLog) {
                return res.status(400).send({
                    success: false,
                    message: `${user.firstname} is already checked in today.`
                });
            }

            // Verify if completed session exists today
            const completedLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: { [db.Sequelize.Op.ne]: null }
                }
            });

            if (completedLog) {
                return res.status(400).send({
                    success: false,
                    message: `${user.firstname} has already completed attendance for today.`
                });
            }

            // Create check-in record
            const attendance = {
                staff_id: user.staffid,
                check_in_time: now,
                date: todayDateOnly,
                phone_model: phone_model || 'Mobile Kiosk Terminal',
                ip_address: getClientIp(req),
                latitude: latitude || null,
                longitude: longitude || null
            };

            await AttendanceLog.create(attendance);

            await logActivity({
                admin_id: req.userId,
                action: 'KIOSK_CHECK_IN',
                entity: 'AttendanceLog',
                affected_user_id: user.staffid,
                description: `Kiosk Check-In recorded for ${user.firstname} ${user.lastname}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            return res.status(200).send({
                success: true,
                message: `Check-in successful! Welcome, ${user.firstname}.`,
                action: 'CHECK_IN',
                employeeName: `${user.firstname} ${user.lastname}`,
                timestamp: formattedNowTime
            });

        } else {
            // CHECK_OUT: Find active check-in
            const existingLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: null
                },
                order: [['check_in_time', 'DESC']]
            });

            if (!existingLog) {
                return res.status(400).send({
                    success: false,
                    message: `No active check-in found for ${user.firstname}. Please check in first.`
                });
            }

            await existingLog.update({
                check_out_time: now
            });

            if (user.approving_manager_id) {
                await Approval.create({
                    attendance_log_id: existingLog.id,
                    manager_id: user.approving_manager_id,
                    status: 'pending'
                });
            }

            await logActivity({
                admin_id: req.userId,
                action: 'KIOSK_CHECK_OUT',
                entity: 'AttendanceLog',
                entity_id: existingLog.id,
                affected_user_id: user.staffid,
                description: `Kiosk Check-Out recorded for ${user.firstname} ${user.lastname}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            let durationText = '';
            if (existingLog.check_in_time) {
                const diffMs = now.getTime() - new Date(existingLog.check_in_time).getTime();
                const totalMinutes = Math.floor(diffMs / 60000);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
            }

            return res.status(200).send({
                success: true,
                message: `Check-out successful! Goodbye, ${user.firstname}.`,
                action: 'CHECK_OUT',
                employeeName: `${user.firstname} ${user.lastname}`,
                timestamp: formattedNowTime,
                duration: durationText
            });
        }

    } catch (err) {
        console.error("Error recording kiosk attendance:", err);
        res.status(500).send({ message: err.message || "Error processing kiosk attendance." });
    }
};

/**
 * Generate a dynamic QR attendance badge for the authenticated employee
 * GET /api/attendance/my-badge
 */
exports.getMyBadgeData = async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role', 'active', 'face_image_path']
        });

        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        if (user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({ message: "Employee account is inactive." });
        }

        // Get Role name
        let roleName = 'Staff';
        if (user.role) {
            const roleObj = await Role.findByPk(user.role);
            if (roleObj) roleName = roleObj.display_name || roleObj.name;
        }

        // Get Employee profile image and department if available
        let profileImage = user.face_image_path ? user.face_image_path.replace(/\\/g, '/') : null;
        let department = null;
        try {
            const empProfile = await EmployeeProfile.findOne({ where: { staff_id: user.staffid } });
            if (empProfile) {
                if (empProfile.image_path) profileImage = empProfile.image_path.replace(/\\/g, '/');
                if (empProfile.department) department = empProfile.department;
            }
        } catch (_) {}

        // Get today's attendance status
        const tz = await getAppTimezone();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        let todayStatus = 'NOT_CHECKED_IN';
        let checkInTime = null;

        const openLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null
            }
        });

        if (openLog) {
            todayStatus = 'CHECKED_IN';
            checkInTime = formatDateInTimezone(openLog.check_in_time, tz);
        } else {
            const completedLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: { [db.Sequelize.Op.ne]: null }
                }
            });
            if (completedLog) {
                todayStatus = 'COMPLETED';
            }
        }

        // Generate HMAC-SHA256 signed dynamic badge token
        const badgeInfo = badgeSecurity.generateBadgeToken({
            staffId: user.staffid,
            email: user.email,
            name: `${user.firstname} ${user.lastname}`
        });

        return res.status(200).send({
            success: true,
            qrPayload: badgeInfo.token,
            expiresAt: badgeInfo.expiresAt,
            ttlSeconds: badgeInfo.ttlSeconds,
            employee: {
                staffId: user.staffid,
                name: `${user.firstname} ${user.lastname}`,
                email: user.email,
                role: roleName,
                department,
                avatarUrl: profileImage
            },
            todayStatus,
            checkInTime
        });

    } catch (err) {
        console.error("Error generating dynamic badge data:", err);
        res.status(500).send({ message: err.message || "Error generating dynamic badge." });
    }
};

/**
 * Verify and record attendance from scanned dynamic QR badge at kiosk terminal
 * POST /api/attendance/scan-qr-badge
 */
exports.scanQrBadgeAttendance = async (req, res) => {
    const { qrPayload, latitude, longitude, phone_model } = req.body;

    if (!qrPayload) {
        return res.status(400).send({
            success: false,
            message: "QR badge payload is required."
        });
    }

    try {
        // 1. Verify cryptographic validity, expiration & replay protection
        const verification = badgeSecurity.verifyBadgeToken(qrPayload);
        if (!verification.valid) {
            return res.status(400).send({
                success: false,
                message: verification.error || "Invalid or expired QR badge. Please refresh."
            });
        }

        const { staffId, email } = verification.data;

        // 2. Fetch employee details
        const user = await User.findOne({
            where: {
                [db.Sequelize.Op.or]: [
                    { staffid: staffId },
                    { email: email }
                ]
            }
        });

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "Employee not found."
            });
        }

        if (user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({
                success: false,
                message: "Employee account is inactive."
            });
        }

        const tz = await getAppTimezone();
        const now = new Date();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];
        const formattedNowTime = formatDateInTimezone(now, tz);

        // Fetch avatar for display
        let avatarUrl = user.face_image_path ? user.face_image_path.replace(/\\/g, '/') : null;
        try {
            const empProfile = await EmployeeProfile.findOne({ where: { staff_id: user.staffid } });
            if (empProfile && empProfile.image_path) {
                avatarUrl = empProfile.image_path.replace(/\\/g, '/');
            }
        } catch (_) {}

        // 3. Determine whether to CHECK_IN or CHECK_OUT
        const existingOpenLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null
            },
            order: [['check_in_time', 'DESC']]
        });

        if (!existingOpenLog) {
            // Check if already completed today
            const completedLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: { [db.Sequelize.Op.ne]: null }
                }
            });

            if (completedLog) {
                return res.status(400).send({
                    success: false,
                    message: `${user.firstname} ${user.lastname} has already completed attendance for today.`
                });
            }

            // Perform CHECK_IN
            const attendance = {
                staff_id: user.staffid,
                check_in_time: now,
                date: todayDateOnly,
                phone_model: phone_model || 'Front Desk QR Terminal',
                ip_address: getClientIp(req),
                latitude: latitude || null,
                longitude: longitude || null
            };

            const createdLog = await AttendanceLog.create(attendance);

            await logActivity({
                admin_id: req.userId,
                action: 'BADGE_QR_CHECK_IN',
                entity: 'AttendanceLog',
                entity_id: createdLog.id,
                affected_user_id: user.staffid,
                description: `Dynamic QR Badge Check-In recorded for ${user.firstname} ${user.lastname}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            return res.status(200).send({
                success: true,
                type: 'CHECK_IN',
                employeeName: `${user.firstname} ${user.lastname}`,
                email: user.email,
                timestamp: formattedNowTime,
                avatarUrl,
                message: `Welcome, ${user.firstname}! Check-in recorded at ${formattedNowTime.split(' ')[1] || formattedNowTime}.`
            });

        } else {
            // Perform CHECK_OUT
            await existingOpenLog.update({
                check_out_time: now
            });

            if (user.approving_manager_id) {
                await Approval.create({
                    attendance_log_id: existingOpenLog.id,
                    manager_id: user.approving_manager_id,
                    status: 'pending'
                });
            }

            await logActivity({
                admin_id: req.userId,
                action: 'BADGE_QR_CHECK_OUT',
                entity: 'AttendanceLog',
                entity_id: existingOpenLog.id,
                affected_user_id: user.staffid,
                description: `Dynamic QR Badge Check-Out recorded for ${user.firstname} ${user.lastname}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            let durationText = '';
            if (existingOpenLog.check_in_time) {
                const diffMs = now.getTime() - new Date(existingOpenLog.check_in_time).getTime();
                const totalMinutes = Math.floor(diffMs / 60000);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
            }

            return res.status(200).send({
                success: true,
                type: 'CHECK_OUT',
                employeeName: `${user.firstname} ${user.lastname}`,
                email: user.email,
                timestamp: formattedNowTime,
                avatarUrl,
                duration: durationText,
                message: `Goodbye, ${user.firstname}! Check-out recorded. Total time: ${durationText || 'completed'}.`
            });
        }

    } catch (err) {
        console.error("Error scanning QR badge attendance:", err);
        res.status(500).send({
            success: false,
            message: err.message || "Error processing QR badge scan."
        });
    }
};

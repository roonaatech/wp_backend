const db = require("../models");
const User = db.user;
const Role = db.roles;
const EmployeeProfile = db.employee_profiles;
const AttendanceLog = db.attendance_logs;
const Approval = db.approvals;
const Setting = db.settings;
const EmployeeDevice = db.employee_devices;
const LeaveRequest = db.leave_requests;
const Op = db.Sequelize.Op;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const timezoneUtil = require("../utils/timezone.util");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const faceBiometrics = require("../services/face_biometrics.service");
const badgeSecurity = require("../services/badge_security.service");
const deviceSecurity = require("../services/device_security.service");
const { normalizeWorkMode } = require("../utils/workmode.util");

// Cache of pending QR badge attendance confirmations (expires in 60 seconds)
const pendingQrConfirmations = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of pendingQrConfirmations.entries()) {
        if (now > val.expiresAt) {
            pendingQrConfirmations.delete(key);
        }
    }
}, 30 * 1000).unref?.();

// Helper to get application timezone
const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

// Helper to get application time format (12h or 24h)
const getAppTimeFormat = async () => {
    try {
        const fmtSetting = await Setting.findOne({ where: { key: 'application_time_format' } });
        return fmtSetting ? fmtSetting.value : '12h';
    } catch (e) {
        return '12h';
    }
};

/**
 * Determine whether today is a Work From Home day for an employee based on their work_mode and hybrid schedule.
 * Returns: { work_mode, today_day_of_week, is_wfh_day, scheduled_office_today, can_punch_wfh }
 */
const checkUserWfhToday = (user, tz, clientTimezone) => {
    const rawMode = normalizeWorkMode(user?.work_mode);
    const effectiveTz = clientTimezone || tz || 'Asia/Kolkata';
    const now = new Date();
    // Weekday name in effective timezone, e.g. "Monday", "Tuesday", etc.
    let todayDayOfWeek;
    try {
        todayDayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: effectiveTz }).format(now);
    } catch (_) {
        todayDayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz || 'Asia/Kolkata' }).format(now);
    }

    let isWfhDay = false;
    let scheduledOfficeToday = false;

    if (rawMode === 'Work from home') {
        isWfhDay = true;
        scheduledOfficeToday = false;
    } else if (rawMode === 'Hybrid') {
        let officeDays = user?.hybrid_office_days;
        if (typeof officeDays === 'string') {
            try { officeDays = JSON.parse(officeDays); } catch (_) { officeDays = []; }
        }
        if (Array.isArray(officeDays) && officeDays.length > 0) {
            const normalizedOfficeDays = officeDays.map(d => String(d).trim().toLowerCase());
            const todayLower = todayDayOfWeek.toLowerCase();
            const todayShort = todayLower.slice(0, 3); // "mon", "tue", "wed", etc.

            scheduledOfficeToday = normalizedOfficeDays.includes(todayLower) ||
                normalizedOfficeDays.some(d => d.startsWith(todayShort) || todayLower.startsWith(d));
        }

        // Hybrid mode: In-office days require kiosk badge scan; remote days allow WFH punch
        isWfhDay = !scheduledOfficeToday;
    } else {
        // Office or others
        isWfhDay = false;
        scheduledOfficeToday = true;
    }

    return {
        work_mode: rawMode,
        today_day_of_week: todayDayOfWeek,
        is_wfh_day: isWfhDay,
        scheduled_office_today: scheduledOfficeToday,
        can_punch_wfh: isWfhDay
    };
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

        // Check if employee is on approved full-day leave today
        const approvedFullDayLeave = await LeaveRequest.findOne({
            where: {
                staff_id: user.staffid,
                status: 'Approved',
                start_date: { [Op.lte]: todayDateOnly },
                end_date: { [Op.gte]: todayDateOnly }
            }
        });

        if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
            return res.status(200).send({
                status: 'ON_LEAVE',
                employeeName: `${user.firstname} ${user.lastname}`,
                leaveType: approvedFullDayLeave.leave_type || 'Leave'
            });
        }

        return res.status(200).send({ status: 'NOT_CHECKED_IN', employeeName: `${user.firstname} ${user.lastname}` });

    } catch (err) {
        console.error("Error checking attendance status:", err);
        res.status(500).send({ message: err.message || "Error checking attendance status." });
    }
};

/**
 * Current employee's attendance status today
 * GET /api/attendance/today
 */
exports.getMyTodayAttendance = async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        const tz = await getAppTimezone();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        // 1. Check for open check-in today
        const openLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null,
                check_in_time: { [Op.ne]: null }
            }
        });

        // 2. Check for completed session today
        const completedLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: { [Op.ne]: null },
                check_in_time: { [Op.ne]: null }
            }
        });

        // 3. Check for approved full-day leave today
        const approvedLeave = await LeaveRequest.findOne({
            where: {
                staff_id: user.staffid,
                status: 'Approved',
                start_date: { [Op.lte]: todayDateOnly },
                end_date: { [Op.gte]: todayDateOnly }
            }
        });

        let status = 'NOT_CHECKED_IN';
        if (openLog) status = 'CHECKED_IN';
        else if (completedLog) status = 'COMPLETED';
        else if (approvedLeave && !approvedLeave.is_half_day) status = 'ON_LEAVE';

        return res.status(200).send({
            date: todayDateOnly,
            status,
            checkedIn: Boolean(openLog), // Currently checked in and NOT yet checked out
            hasCheckIn: Boolean(openLog || completedLog),
            hasCheckOut: Boolean(completedLog),
            checkInTime: openLog?.check_in_time || completedLog?.check_in_time || null,
            checkOutTime: completedLog?.check_out_time || null,
            leaveType: approvedLeave ? approvedLeave.leave_type : null
        });
    } catch (err) {
        console.error("Error fetching today attendance:", err);
        res.status(500).send({ message: err.message || "Error fetching today attendance." });
    }
};

/**
 * Current employee's dates with recorded attendance check-ins
 * GET /api/attendance/my-attended-dates
 */
exports.getMyAttendedDates = async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        const logs = await AttendanceLog.findAll({
            where: {
                staff_id: user.staffid,
                check_in_time: { [Op.ne]: null }
            },
            attributes: ['date', 'check_in_time', 'check_out_time'],
            order: [['date', 'DESC']],
            limit: 200
        });

        const attendedDates = [...new Set(logs.map(l => l.date).filter(Boolean))];
        return res.status(200).send({
            attendedDates,
            logs
        });
    } catch (err) {
        console.error("Error fetching attended dates:", err);
        res.status(500).send({ message: err.message || "Error fetching attended dates." });
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

        if (action === 'CHECK_IN') {
            const tz = await getAppTimezone();
            const nowString = timezoneUtil.getNowStringInTimezone(tz);
            const todayDateOnly = nowString.split(' ')[0];
            const approvedFullDayLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: user.staffid,
                    status: 'Approved',
                    start_date: { [Op.lte]: todayDateOnly },
                    end_date: { [Op.gte]: todayDateOnly }
                }
            });

            if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
                return res.status(400).send({
                    success: false,
                    message: "You are on approved leave for today. Attendance check-in is not allowed."
                });
            }
        }

        if (!livenessVerified) {
            const passwordIsValid = bcrypt.compareSync(password, user.password);
            if (!passwordIsValid) {
                return res.status(400).send({ message: "Invalid Password!" });
            }
        }

        // Single Device Security & Proxy Attendance Prevention (Mobile Only for Check-In / Check-Out)
        const isMobileHeader = req.headers['x-is-mobile'];
        const isMobileAppHeader = req.headers['x-is-mobile-app'];
        const userAgent = getUserAgent(req);
        const deviceId = req.headers['x-device-id'] || req.body.deviceId || req.body.device_id || req.query.deviceId;
        const deviceName = req.headers['x-device-name'] || req.body.deviceName || req.body.device_name || phone_model;

        const isMobileClient = deviceSecurity.isMobileClient({
            userAgent,
            isMobile: isMobileHeader,
            isMobileApp: isMobileAppHeader,
            deviceId
        });

        if (isMobileClient) {
            if (!deviceId) {
                return res.status(400).send({
                    success: false,
                    message: "Device identification is required for mobile attendance check-in/out."
                });
            }

            const clientIp = getClientIp(req);
            const isMobileApp = (isMobileAppHeader === 'true' || isMobileAppHeader === true || deviceId.startsWith('wp-dev-app-'));

            const deviceCheck = await deviceSecurity.verifyAndBindDevice({
                staffId: user.staffid,
                deviceId,
                deviceName,
                userAgent,
                ipAddress: clientIp,
                isMobile: true,
                isMobileApp,
                action: action === 'CHECK_IN' ? 'MOBILE_FACE_CHECK_IN' : 'MOBILE_FACE_CHECK_OUT'
            });

            if (!deviceCheck.allowed) {
                return res.status(403).send({
                    success: false,
                    deviceViolation: true,
                    message: deviceCheck.error
                });
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
            // Verify employee is not on approved full-day leave today
            const approvedFullDayLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: user.staffid,
                    status: 'Approved',
                    start_date: { [Op.lte]: todayDateOnly },
                    end_date: { [Op.gte]: todayDateOnly }
                }
            });

            if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
                return res.status(400).send({
                    success: false,
                    message: "You are on approved leave for today. Attendance check-in is not allowed."
                });
            }

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
        const safeHour = String(parseInt(p.hour, 10) % 24).padStart(2, '0');
        return `${p.year}-${p.month}-${p.day} ${safeHour}:${p.minute}:${p.second}`;
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
        const { page = 1, limit = 10, userId, startDate, endDate, status, punchSource } = req.query;
        const limitVal = parseInt(limit);
        const offsetVal = (parseInt(page) - 1) * limitVal;

        const whereClause = {};

        if (punchSource && punchSource !== 'all') {
            whereClause.punch_source = punchSource;
        }

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

        const { getAttendanceConfig } = require('../utils/attendanceConfig');
        const attConfig = await getAttendanceConfig();

        res.status(200).send({
            totalItems: count,
            totalPages: Math.ceil(count / limitVal),
            currentPage: parseInt(page),
            compliance_hours: attConfig.complianceHours,
            office_start_time: attConfig.startTime,
            office_end_time: attConfig.endTime,
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

        // Subordinate scope check
        if (req.attendanceEditScope === 'subordinates') {
            const targetUser = log.user || await User.findByPk(log.staff_id);
            if (!targetUser || parseInt(targetUser.approving_manager_id) !== parseInt(req.userId)) {
                return res.status(403).send({
                    message: "You can only edit attendance records for your direct subordinates."
                });
            }
        }

        const oldValues = {
            check_out_time: log.check_out_time
        };

        const tz = await getAppTimezone();

        const updateData = {};

        // Parse the checkout string if provided. It represents wall-clock
        // time in the app's configured timezone. To eliminate any client date shift
        // or UTC offset discrepancies, extract the time portion and anchor it strictly
        // to log.date (the attendance day).
        if (check_out_time) {
            const rawStr = String(check_out_time).trim();
            const timeMatch = rawStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
            if (!timeMatch) {
                return res.status(400).send({ message: "Invalid check-out time format." });
            }
            let hh = parseInt(timeMatch[1], 10);
            const mm = timeMatch[2];
            const ss = timeMatch[3] || '00';
            const ampm = timeMatch[4]?.toUpperCase();

            if (ampm === 'PM' && hh < 12) {
                hh += 12;
            } else if (ampm === 'AM' && hh === 12) {
                hh = 0;
            } else if (!ampm && hh <= 12 && log.check_in_time) {
                // If 12h without AM/PM: e.g. check-in is 09:30 and checkout entered as 06:30,
                // auto-infer PM (18:30) if checkout hour is before morning check-in hour
                const checkInFormatted = formatDateInTimezone(log.check_in_time, tz);
                const inMatch = checkInFormatted?.match(/\s(\d{2}):(\d{2})/);
                if (inMatch) {
                    const inH = parseInt(inMatch[1], 10);
                    if (inH >= 7 && hh < inH && hh + 12 < 24) {
                        hh += 12;
                    }
                }
            }

            const timePart = `${String(hh).padStart(2, '0')}:${mm}:${ss}`;

            // Anchor to log.date
            const logDateStr = typeof log.date === 'string' ? log.date.split('T')[0] : formatDateInTimezone(log.date, tz).split(' ')[0];
            const normalizedDateTimeStr = `${logDateStr} ${timePart}`;

            updateData.check_out_time = timezoneUtil.parseTimeInTimezone(normalizedDateTimeStr, tz);

            // Reject check-out times that are before or equal to check-in time
            if (log.check_in_time) {
                const checkInDate = new Date(log.check_in_time);
                if (updateData.check_out_time.getTime() <= checkInDate.getTime()) {
                    return res.status(400).send({ message: "Check-out time must be after check-in time." });
                }
            }
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

        // Subordinate scope check
        if (req.attendanceDeleteScope === 'subordinates') {
            const targetUser = log.user || await User.findByPk(log.staff_id);
            if (!targetUser || parseInt(targetUser.approving_manager_id) !== parseInt(req.userId)) {
                return res.status(403).send({
                    message: "You can only delete attendance records for your direct subordinates."
                });
            }
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
            // Verify employee is not on approved full-day leave today
            const approvedFullDayLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: user.staffid,
                    status: 'Approved',
                    start_date: { [Op.lte]: todayDateOnly },
                    end_date: { [Op.gte]: todayDateOnly }
                }
            });

            if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
                return res.status(400).send({
                    success: false,
                    message: `${user.firstname} ${user.lastname} is on approved leave today. Attendance check-in is not allowed.`
                });
            }

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
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role', 'active', 'face_image_path', 'work_mode', 'hybrid_office_days']
        });

        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        if (user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({ message: "Employee account is inactive." });
        }

        // Single Device Security & Proxy Attendance Prevention (Mobile Only for Badge Access)
        const isMobileHeader = req.headers['x-is-mobile'];
        const isMobileAppHeader = req.headers['x-is-mobile-app'];
        const userAgent = getUserAgent(req);
        const deviceId = req.headers['x-device-id'] || req.query?.deviceId || req.query?.device_id;
        const deviceName = req.headers['x-device-name'] || req.query?.deviceName || req.query?.device_name;
        const deviceModel = req.headers['x-device-model'] || req.query?.deviceModel || req.query?.device_model;

        const isMobile = deviceSecurity.isMobileClient({
            userAgent,
            isMobile: isMobileHeader,
            isMobileApp: isMobileAppHeader,
            deviceId
        });

        const isMobileApp = (
            isMobileAppHeader === 'true' ||
            isMobileAppHeader === true ||
            (deviceId && typeof deviceId === 'string' && deviceId.startsWith('wp-dev-app-'))
        );

        if (deviceId) {
            const clientIp = getClientIp(req);
            const deviceCheck = await deviceSecurity.verifyAndBindDevice({
                staffId: user.staffid,
                deviceId,
                deviceName,
                deviceModel,
                userAgent,
                ipAddress: clientIp,
                isMobile: isMobile,
                isMobileApp: isMobileApp,
                action: 'SMART_BADGE_ACCESS'
            });

            if (!deviceCheck.allowed) {
                return res.status(403).send({
                    success: false,
                    deviceViolation: true,
                    message: deviceCheck.error
                });
            }
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
        const clientTz = req.headers['x-client-timezone'] || req.query?.clientTimezone || req.query?.timezone;
        let displayTz = tz;
        if (clientTz && typeof clientTz === 'string') {
            try {
                Intl.DateTimeFormat(undefined, { timeZone: clientTz });
                displayTz = clientTz;
            } catch (_) {}
        }
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        let todayStatus = 'NOT_CHECKED_IN';
        let checkInTime = null;
        let checkOutTime = null;
        let checkInIso = null;

        let openLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null
            },
            order: [['check_in_time', 'DESC']]
        });
        if (!openLog) {
            // Robust fallback across day/timezone boundaries: find any active unclosed punch for this user
            openLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    check_out_time: null
                },
                order: [['check_in_time', 'DESC']]
            });
        }

        if (openLog) {
            todayStatus = 'CHECKED_IN';
            checkInTime = formatDateInTimezone(openLog.check_in_time, displayTz);
            checkInIso = openLog.check_in_time;
        } else {
            const completedLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: { [db.Sequelize.Op.ne]: null }
                },
                order: [['check_out_time', 'DESC']]
            });
            if (completedLog) {
                todayStatus = 'COMPLETED';
                checkInTime = formatDateInTimezone(completedLog.check_in_time, displayTz);
                checkOutTime = formatDateInTimezone(completedLog.check_out_time, displayTz);
                checkInIso = completedLog.check_in_time;
            }
        }

        // Check if employee is on approved full-day leave today
        const approvedBadgeLeave = await LeaveRequest.findOne({
            where: {
                staff_id: user.staffid,
                status: 'Approved',
                start_date: { [Op.lte]: todayDateOnly },
                end_date: { [Op.gte]: todayDateOnly }
            }
        });

        if (approvedBadgeLeave && !approvedBadgeLeave.is_half_day && todayStatus === 'NOT_CHECKED_IN') {
            todayStatus = 'ON_LEAVE';
        }

        // Determine if employee is authorized for WFH today
        const clientTz = req.headers['x-client-timezone'] || req.query?.clientTimezone || req.query?.timezone;
        const wfhCheck = checkUserWfhToday(user, tz, clientTz);

        let parsedHybridOfficeDays = user.hybrid_office_days;
        if (typeof parsedHybridOfficeDays === 'string') {
            try { parsedHybridOfficeDays = JSON.parse(parsedHybridOfficeDays); } catch (_) { parsedHybridOfficeDays = []; }
        }
        if (!Array.isArray(parsedHybridOfficeDays)) parsedHybridOfficeDays = [];

        // Generate HMAC-SHA256 signed dynamic badge token (Office days only)
        let badgeInfo = null;
        if (!wfhCheck.is_wfh_day) {
            badgeInfo = badgeSecurity.generateBadgeToken({
                staffId: user.staffid,
                email: user.email,
                name: `${user.firstname} ${user.lastname}`,
                deviceId: deviceId || null,
                isMobileApp: isMobileApp === true
            });
        }

        // If today is a Work From Home day (Full WFH or Hybrid remote day):
        if (wfhCheck.is_wfh_day) {
            return res.status(200).send({
                success: true,
                isWfhDay: true,
                workMode: wfhCheck.work_mode,
                todayDayOfWeek: wfhCheck.today_day_of_week,
                canPunchWfh: true,
                scheduledOfficeToday: wfhCheck.scheduled_office_today,
                qrPayload: null, // No QR badge on WFH days
                expiresAt: null,
                ttlSeconds: 5,
                hybridOfficeDays: parsedHybridOfficeDays,
                message: wfhCheck.work_mode === 'Hybrid'
                    ? `Hybrid remote day (${wfhCheck.today_day_of_week}). WFH remote attendance punch enabled.`
                    : "Remote WFH attendance enabled for today. Kiosk QR badge is hidden.",
                badge: {
                    staffId: user.staffid,
                    name: `${user.firstname} ${user.lastname}`,
                    email: user.email,
                    role: roleName,
                    department,
                    avatarUrl: profileImage,
                    qrPayload: null,
                    expiresAt: null,
                    ttlSeconds: 5,
                    isWfhDay: true,
                    workMode: wfhCheck.work_mode,
                    todayDayOfWeek: wfhCheck.today_day_of_week,
                    scheduledOfficeToday: wfhCheck.scheduled_office_today,
                    hybridOfficeDays: parsedHybridOfficeDays,
                    todayStatus,
                    checkInTime,
                    checkOutTime,
                    checkInIso
                },
                employee: {
                    staffId: user.staffid,
                    name: `${user.firstname} ${user.lastname}`,
                    email: user.email,
                    role: roleName,
                    department,
                    avatarUrl: profileImage
                },
                todayStatus,
                checkInTime,
                checkOutTime,
                checkInIso
            });
        }

        // Generate HMAC-SHA256 signed dynamic badge token (Office days only)
        if (!badgeInfo) {
            badgeInfo = badgeSecurity.generateBadgeToken({
                staffId: user.staffid,
                email: user.email,
                name: `${user.firstname} ${user.lastname}`,
                deviceId: deviceId || null,
                isMobileApp: isMobileApp === true
            });
        }

        return res.status(200).send({
            success: true,
            isWfhDay: false,
            workMode: wfhCheck.work_mode,
            todayDayOfWeek: wfhCheck.today_day_of_week,
            canPunchWfh: false,
            scheduledOfficeToday: wfhCheck.scheduled_office_today,
            qrPayload: badgeInfo.token,
            expiresAt: badgeInfo.expiresAt,
            ttlSeconds: badgeInfo.ttlSeconds,
            hybridOfficeDays: parsedHybridOfficeDays,
            badge: {
                staffId: user.staffid,
                name: `${user.firstname} ${user.lastname}`,
                email: user.email,
                role: roleName,
                department,
                avatarUrl: profileImage,
                qrPayload: badgeInfo.token,
                expiresAt: badgeInfo.expiresAt,
                ttlSeconds: badgeInfo.ttlSeconds,
                isWfhDay: false,
                workMode: wfhCheck.work_mode,
                todayDayOfWeek: wfhCheck.today_day_of_week,
                scheduledOfficeToday: wfhCheck.scheduled_office_today,
                hybridOfficeDays: parsedHybridOfficeDays,
                todayStatus,
                checkInTime,
                checkOutTime,
                checkInIso
            },
            employee: {
                staffId: user.staffid,
                name: `${user.firstname} ${user.lastname}`,
                email: user.email,
                role: roleName,
                department,
                avatarUrl: profileImage
            },
            todayStatus,
            checkInTime,
            checkOutTime,
            checkInIso
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
    const { qrPayload, latitude, longitude, phone_model, confirmed, confirmationToken } = req.body;

    try {
        const tz = await getAppTimezone();
        const timeFormat = await getAppTimeFormat();
        const now = new Date();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];
        const formattedNowTime = formatDateInTimezone(now, tz);
        const displayTime = timezoneUtil.formatInTimezone(now, tz, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: timeFormat !== '24h'
        });

        // =========================================================================
        // CASE A: User clicked YES to confirm impending Check-In / Check-Out
        // =========================================================================
        if (confirmed === true && confirmationToken) {
            const pending = pendingQrConfirmations.get(confirmationToken);
            if (!pending || Date.now() > pending.expiresAt) {
                pendingQrConfirmations.delete(confirmationToken);
                return res.status(400).send({
                    success: false,
                    message: "Confirmation timed out or expired. Please scan badge again."
                });
            }
            pendingQrConfirmations.delete(confirmationToken);

            const user = await User.findOne({ where: { staffid: pending.staffId } });
            if (!user || user.active == 0 || user.active === false || user.active === '0') {
                return res.status(403).send({
                    success: false,
                    message: "Employee account is inactive or not found."
                });
            }

            if (pending.action === 'CHECK_IN') {
                const approvedFullDayLeave = await LeaveRequest.findOne({
                    where: {
                        staff_id: user.staffid,
                        status: 'Approved',
                        start_date: { [Op.lte]: todayDateOnly },
                        end_date: { [Op.gte]: todayDateOnly }
                    }
                });

                if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
                    return res.status(400).send({
                        success: false,
                        message: `${user.firstname} ${user.lastname} is on approved leave today. Attendance check-in is not allowed.`
                    });
                }

                const attendance = {
                    staff_id: user.staffid,
                    check_in_time: now,
                    date: todayDateOnly,
                    phone_model: pending.phone_model || 'Front Desk QR Terminal',
                    ip_address: getClientIp(req),
                    latitude: pending.latitude || null,
                    longitude: pending.longitude || null
                };

                const createdLog = await AttendanceLog.create(attendance);

                await logActivity({
                    admin_id: req.userId || pending.adminId,
                    action: 'BADGE_QR_CHECK_IN',
                    entity: 'AttendanceLog',
                    entity_id: createdLog.id,
                    affected_user_id: user.staffid,
                    description: `Dynamic QR Badge Check-In confirmed for ${user.firstname} ${user.lastname}`,
                    ip_address: getClientIp(req),
                    user_agent: getUserAgent(req)
                });

                return res.status(200).send({
                    success: true,
                    type: 'CHECK_IN',
                    employeeName: `${user.firstname} ${user.lastname}`,
                    email: user.email,
                    timestamp: formattedNowTime,
                    time: displayTime,
                    avatarUrl: pending.avatarUrl,
                    message: `Welcome, ${user.firstname}! Check-in recorded at ${displayTime}.`
                });
            } else {
                // Perform CHECK_OUT
                const existingOpenLog = await AttendanceLog.findOne({
                    where: {
                        staff_id: user.staffid,
                        date: todayDateOnly,
                        check_out_time: null
                    },
                    order: [['check_in_time', 'DESC']]
                });

                if (!existingOpenLog) {
                    return res.status(400).send({
                        success: false,
                        message: "No active check-in found to check out."
                    });
                }

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
                    admin_id: req.userId || pending.adminId,
                    action: 'BADGE_QR_CHECK_OUT',
                    entity: 'AttendanceLog',
                    entity_id: existingOpenLog.id,
                    affected_user_id: user.staffid,
                    description: `Dynamic QR Badge Check-Out confirmed for ${user.firstname} ${user.lastname}`,
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
                    time: displayTime,
                    avatarUrl: pending.avatarUrl,
                    duration: durationText,
                    message: `Goodbye, ${user.firstname}! Check-out recorded. Total time: ${durationText || 'completed'}.`
                });
            }
        }

        // =========================================================================
        // CASE B: Initial Scan -> Verify & Return Confirmation Preview
        // =========================================================================
        if (!qrPayload) {
            return res.status(400).send({
                success: false,
                message: "QR badge payload is required."
            });
        }

        // 1. Verify cryptographic validity, expiration & anti-replay
        const verification = badgeSecurity.verifyBadgeToken(qrPayload);
        if (!verification.valid) {
            return res.status(400).send({
                success: false,
                message: verification.error || "Invalid or expired QR badge. Please refresh."
            });
        }

        const { staffId, email, deviceId: badgeDeviceId } = verification.data;

        // Verify device integrity: If the badge was generated from a mobile device, ensure that device isn't registered to another employee
        if (badgeDeviceId && typeof badgeDeviceId === 'string' && (badgeDeviceId.startsWith('wp-dev-app-') || badgeDeviceId.startsWith('wp-dev-'))) {
            const conflictDevice = await EmployeeDevice.findOne({
                where: {
                    device_id: badgeDeviceId,
                    staff_id: { [db.Sequelize.Op.ne]: staffId },
                    is_active: true
                }
            });

            if (conflictDevice) {
                console.warn(`[SECURITY ALERT] Scanned QR badge generated on conflicting device ${badgeDeviceId} bound to staff #${conflictDevice.staff_id}, but presented for staff #${staffId}.`);
                return res.status(403).send({
                    success: false,
                    deviceViolation: true,
                    message: "Security Violation: This QR badge was generated on a mobile device registered to another employee. Attendance scan has been rejected."
                });
            }
        }

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

        // Fetch avatar for display
        let avatarUrl = user.face_image_path ? user.face_image_path.replace(/\\/g, '/') : null;
        try {
            const empProfile = await EmployeeProfile.findOne({ where: { staff_id: user.staffid } });
            if (empProfile && empProfile.image_path) {
                avatarUrl = empProfile.image_path.replace(/\\/g, '/');
            }
        } catch (_) {}

        // 3. Determine whether next action is CHECK_IN or CHECK_OUT
        const existingOpenLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null
            },
            order: [['check_in_time', 'DESC']]
        });

        let actionType = 'CHECK_IN';
        let durationText = '';

        if (!existingOpenLog) {
            // Check if employee is on approved full-day leave today
            const approvedFullDayLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: user.staffid,
                    status: 'Approved',
                    start_date: { [Op.lte]: todayDateOnly },
                    end_date: { [Op.gte]: todayDateOnly }
                }
            });

            if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
                return res.status(400).send({
                    success: false,
                    message: `${user.firstname} ${user.lastname} is on approved leave today. Attendance check-in is not allowed.`
                });
            }

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
            actionType = 'CHECK_IN';
        } else {
            actionType = 'CHECK_OUT';
            if (existingOpenLog.check_in_time) {
                const diffMs = now.getTime() - new Date(existingOpenLog.check_in_time).getTime();
                const totalMinutes = Math.floor(diffMs / 60000);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
            }
        }

        // Generate a secure, short-lived confirmation token (60 seconds)
        const token = crypto.randomBytes(24).toString('hex');
        pendingQrConfirmations.set(token, {
            staffId: user.staffid,
            userId: user.id,
            action: actionType,
            latitude: latitude || null,
            longitude: longitude || null,
            phone_model: phone_model || 'Front Desk QR Terminal',
            adminId: req.userId,
            avatarUrl,
            employeeName: `${user.firstname} ${user.lastname}`,
            email: user.email,
            expiresAt: Date.now() + 60 * 1000
        });

        return res.status(200).send({
            success: true,
            requiresConfirmation: true,
            confirmationToken: token,
            type: actionType,
            employeeName: `${user.firstname} ${user.lastname}`,
            email: user.email,
            timestamp: formattedNowTime,
            time: displayTime,
            avatarUrl,
            duration: durationText,
            message: `Do you want to ${actionType === 'CHECK_IN' ? 'Check In' : 'Check Out'} as ${user.firstname} ${user.lastname}?`
        });

    } catch (err) {
        console.error("Error scanning QR badge attendance:", err);
        res.status(500).send({
            success: false,
            message: err.message || "Error processing QR badge scan."
        });
    }
};

/**
 * Get current employee's WFH attendance status, work mode configuration, and today's log.
 * GET /api/attendance/wfh-status
 */
exports.getWfhAttendanceStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findByPk(userId);
        if (!user || user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({ success: false, message: "Account inactive or not found." });
        }

        const tz = await getAppTimezone();
        const timeFormat = await getAppTimeFormat();
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];

        const clientTz = req.headers['x-client-timezone'] || req.query?.clientTimezone || req.query?.timezone;
        const wfhCheck = checkUserWfhToday(user, tz, clientTz);

        // Fetch today's active open log
        let activeLog = await AttendanceLog.findOne({
            where: {
                staff_id: user.staffid,
                date: todayDateOnly,
                check_out_time: null
            },
            order: [['check_in_time', 'DESC']]
        });

        // Fetch completed log if not currently open
        let completedLog = null;
        if (!activeLog) {
            completedLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: { [Op.ne]: null }
                },
                order: [['check_out_time', 'DESC']]
            });
        }

        let todayStatus = 'NOT_CHECKED_IN';
        let checkInTime = null;
        let checkOutTime = null;
        let durationText = null;
        let todayLog = null;

        if (activeLog) {
            todayStatus = 'CHECKED_IN';
            todayLog = activeLog;
            checkInTime = formatDateInTimezone(activeLog.check_in_time, tz);
        } else if (completedLog) {
            todayStatus = 'COMPLETED';
            todayLog = completedLog;
            checkInTime = formatDateInTimezone(completedLog.check_in_time, tz);
            checkOutTime = formatDateInTimezone(completedLog.check_out_time, tz);

            if (completedLog.check_in_time && completedLog.check_out_time) {
                const diffMs = new Date(completedLog.check_out_time).getTime() - new Date(completedLog.check_in_time).getTime();
                const totalMinutes = Math.floor(diffMs / 60000);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
            }
        } else {
            // Check if on approved full-day leave
            const approvedLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: user.staffid,
                    status: 'Approved',
                    start_date: { [Op.lte]: todayDateOnly },
                    end_date: { [Op.gte]: todayDateOnly }
                }
            });
            if (approvedLeave && !approvedLeave.is_half_day) {
                todayStatus = 'ON_LEAVE';
            }
        }

        // Fetch role and profile details
        let roleName = 'Staff';
        if (user.role) {
            const roleObj = await Role.findByPk(user.role);
            if (roleObj) roleName = roleObj.display_name || roleObj.name;
        }

        let profileImage = user.face_image_path ? user.face_image_path.replace(/\\/g, '/') : null;
        let department = null;
        try {
            const empProfile = await EmployeeProfile.findOne({ where: { staff_id: user.staffid } });
            if (empProfile) {
                if (empProfile.image_path) profileImage = empProfile.image_path.replace(/\\/g, '/');
                if (empProfile.department) department = empProfile.department;
            }
        } catch (_) {}

        // Fetch system configured office hours
        const { getAttendanceConfig } = require('../utils/attendanceConfig');
        const attConfig = await getAttendanceConfig();

        return res.status(200).send({
            success: true,
            work_mode: wfhCheck.work_mode,
            workMode: wfhCheck.work_mode,
            hybrid_office_days: user.hybrid_office_days || [],
            hybridOfficeDays: user.hybrid_office_days || [],
            today_day_of_week: wfhCheck.today_day_of_week,
            todayDayOfWeek: wfhCheck.today_day_of_week,
            is_wfh_day: wfhCheck.is_wfh_day,
            isWfhDay: wfhCheck.is_wfh_day,
            scheduled_office_today: wfhCheck.scheduled_office_today,
            scheduledOfficeToday: wfhCheck.scheduled_office_today,
            can_punch_wfh: wfhCheck.can_punch_wfh,
            canPunchWfh: wfhCheck.can_punch_wfh,
            todayStatus,
            checkInTime,
            checkOutTime,
            duration: durationText,
            todayLog,
            employee: {
                staffId: user.staffid,
                name: `${user.firstname} ${user.lastname}`,
                email: user.email,
                role: roleName,
                department,
                avatarUrl: profileImage
            },
            officeHours: {
                start: attConfig.startTime || '09:30',
                end: attConfig.endTime || '18:30',
                complianceHours: attConfig.complianceHours || 8
            },
            serverTime: nowString
        });

    } catch (err) {
        console.error("Error in getWfhAttendanceStatus:", err);
        return res.status(500).send({ success: false, message: err.message || "Failed to get WFH status." });
    }
};

/**
 * Record Mobile or Web WFH Attendance Punch (Check-In or Check-Out)
 * POST /api/attendance/wfh-punch
 * Body: { action: 'CHECK_IN' | 'CHECK_OUT', latitude, longitude, notes }
 */
exports.wfhPunch = async (req, res) => {
    const { action, latitude, longitude, notes } = req.body;
    const userId = req.userId;

    if (!['CHECK_IN', 'CHECK_OUT'].includes(action)) {
        return res.status(400).send({
            success: false,
            message: "Invalid action. Must be 'CHECK_IN' or 'CHECK_OUT'."
        });
    }

    try {
        const user = await User.findByPk(userId);
        if (!user || user.active == 0 || user.active === false || user.active === '0') {
            return res.status(403).send({
                success: false,
                message: "Employee account inactive or not found."
            });
        }

        const tz = await getAppTimezone();
        const timeFormat = await getAppTimeFormat();
        const now = new Date();
        const clientTz = req.headers['x-client-timezone'] || req.body?.clientTimezone || req.query?.clientTimezone;
        let displayTz = tz;
        if (clientTz && typeof clientTz === 'string') {
            try {
                Intl.DateTimeFormat(undefined, { timeZone: clientTz });
                displayTz = clientTz;
            } catch (_) {}
        }
        const nowString = timezoneUtil.getNowStringInTimezone(tz);
        const todayDateOnly = nowString.split(' ')[0];
        const formattedNowTime = formatDateInTimezone(now, displayTz);
        const displayTime = timezoneUtil.formatInTimezone(now, displayTz, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: timeFormat !== '24h'
        });

        const wfhCheck = checkUserWfhToday(user, tz, clientTz);
        if (!wfhCheck.is_wfh_day && !wfhCheck.can_punch_wfh) {
            return res.status(403).send({
                success: false,
                message: wfhCheck.work_mode === 'Hybrid'
                    ? `Today (${wfhCheck.today_day_of_week}) is your scheduled in-office day. Please scan your badge at the office kiosk.`
                    : "Remote attendance punch is only available on Work From Home days. Please scan your badge at the office kiosk."
            });
        }

        // 2. Single-Device Security Binding Enforcement (Mobile App & Mobile Web)
        const isMobileHeader = req.headers['x-is-mobile'];
        const isMobileAppHeader = req.headers['x-is-mobile-app'];
        const userAgent = getUserAgent(req);
        const deviceId = req.headers['x-device-id'] || req.body.deviceId;
        const deviceName = req.headers['x-device-name'] || req.body.deviceName;
        const deviceModel = req.headers['x-device-model'] || req.body.deviceModel;

        const isMobileDevice = deviceSecurity.isMobileClient({
            userAgent,
            isMobile: isMobileHeader || req.body.is_mobile || (req.body.client_type === 'mobile_browser'),
            isMobileApp: isMobileAppHeader || req.body.is_mobile_app || (req.body.client_type === 'mobile_app'),
            deviceId
        });

        if (isMobileDevice) {
            const clientIp = getClientIp(req);
            const isMobileApp = (
                isMobileAppHeader === 'true' ||
                isMobileAppHeader === true ||
                req.body.is_mobile_app === true ||
                (deviceId && typeof deviceId === 'string' && deviceId.startsWith('wp-dev-app-'))
            );

            let effectiveDeviceId = (deviceId && typeof deviceId === 'string' && deviceId.trim()) ? deviceId.trim() : null;
            if (!effectiveDeviceId) {
                const model = deviceSecurity.extractDeviceModel({ userAgent, deviceName, deviceModel }) || 'phone';
                effectiveDeviceId = isMobileApp
                    ? `wp-dev-app-${model}-${user.staffid}`
                    : `wp-dev-browser-${model}-${user.staffid}`;
            }

            const deviceCheck = await deviceSecurity.verifyAndBindDevice({
                staffId: user.staffid,
                deviceId: effectiveDeviceId,
                deviceName,
                deviceModel,
                userAgent,
                ipAddress: clientIp,
                isMobile: true,
                isMobileApp,
                action: 'WFH_ATTENDANCE_PUNCH'
            });

            if (!deviceCheck.allowed) {
                return res.status(403).send({
                    success: false,
                    deviceViolation: true,
                    message: deviceCheck.error || "Security Violation: This mobile device is registered to another employee. Attendance punch rejected."
                });
            }
        }

        // 3. Validate Approved Leave Status
        if (action === 'CHECK_IN') {
            const approvedFullDayLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: user.staffid,
                    status: 'Approved',
                    start_date: { [Op.lte]: todayDateOnly },
                    end_date: { [Op.gte]: todayDateOnly }
                }
            });

            if (approvedFullDayLeave && !approvedFullDayLeave.is_half_day) {
                return res.status(400).send({
                    success: false,
                    message: `${user.firstname} ${user.lastname} is on approved leave today. Attendance check-in is not permitted.`
                });
            }
        }

        // 4. Process Action: CHECK_IN or CHECK_OUT
        const clientIp = getClientIp(req);
        const punchSource = isMobileDevice ? 'MOBILE_WFH' : 'WEB_WFH';
        const clientDeviceModel = deviceName || deviceModel || (isMobileDevice ? 'Mobile WFH Client' : 'Web Browser');

        if (action === 'CHECK_IN') {
            const parsedLat = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
            const parsedLng = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;

            // Strict Geolocation Enforcement: Check-in is NOT allowed without valid captured GPS coordinates
            if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || (parsedLat === 0 && parsedLng === 0)) {
                return res.status(400).send({
                    success: false,
                    locationRequired: true,
                    message: "Location service must be enabled to check in. GPS coordinates are strictly required for Work From Home attendance."
                });
            }

            const existingLog = await AttendanceLog.findOne({
                where: { staff_id: user.staffid, date: todayDateOnly }
            });

            if (existingLog) {
                if (existingLog.check_out_time) {
                    return res.status(400).send({
                        success: false,
                        message: "You have already completed attendance for today."
                    });
                }
                return res.status(400).send({
                    success: false,
                    message: `You are already checked in today at ${formatDateInTimezone(existingLog.check_in_time, tz)}.`
                });
            }

            const newLog = await AttendanceLog.create({
                staff_id: user.staffid,
                check_in_time: now,
                date: todayDateOnly,
                phone_model: clientDeviceModel,
                ip_address: clientIp,
                latitude: Number.isFinite(parsedLat) ? parsedLat : null,
                longitude: Number.isFinite(parsedLng) ? parsedLng : null,
                punch_source: punchSource,
                notes: notes ? String(notes).trim() : null
            });

            await logActivity({
                admin_id: user.staffid,
                action: 'WFH_CHECK_IN',
                entity: 'AttendanceLog',
                entity_id: newLog.id,
                affected_user_id: user.staffid,
                description: `Remote WFH Check-In by ${user.firstname} ${user.lastname} (${punchSource})`,
                ip_address: clientIp,
                user_agent: userAgent
            });

            return res.status(200).send({
                success: true,
                type: 'CHECK_IN',
                todayStatus: 'CHECKED_IN',
                message: `WFH Check-In recorded successfully at ${displayTime}.`,
                timestamp: formattedNowTime,
                time: displayTime,
                checkInTime: displayTime,
                checkInIso: newLog.check_in_time,
                log: newLog
            });

        } else {
            // CHECK_OUT
            let activeLog = await AttendanceLog.findOne({
                where: {
                    staff_id: user.staffid,
                    date: todayDateOnly,
                    check_out_time: null
                },
                order: [['check_in_time', 'DESC']]
            });

            if (!activeLog) {
                // Fallback across day boundaries: check for any active unclosed punch for this user
                activeLog = await AttendanceLog.findOne({
                    where: {
                        staff_id: user.staffid,
                        check_out_time: null
                    },
                    order: [['check_in_time', 'DESC']]
                });
            }

            if (!activeLog) {
                return res.status(400).send({
                    success: false,
                    message: "No active check-in found for today to check out."
                });
            }

            let durationText = '';
            if (activeLog.check_in_time) {
                const diffMs = now.getTime() - new Date(activeLog.check_in_time).getTime();
                const totalMinutes = Math.floor(diffMs / 60000);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
            }

            const cleanNotes = notes ? String(notes).trim() : '';
            let combinedNotes = activeLog.notes;
            if (cleanNotes) {
                combinedNotes = combinedNotes ? `${combinedNotes} | Checkout: ${cleanNotes}` : `Checkout: ${cleanNotes}`;
            }

            const parsedLat = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
            const parsedLng = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;

            // Strict Geolocation Enforcement: Check-out is NOT allowed without valid captured GPS coordinates
            if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || (parsedLat === 0 && parsedLng === 0)) {
                return res.status(400).send({
                    success: false,
                    locationRequired: true,
                    message: "Location service must be enabled to check out. GPS coordinates are strictly required for Work From Home attendance."
                });
            }

            await activeLog.update({
                check_out_time: now,
                notes: combinedNotes,
                latitude: parsedLat,
                longitude: parsedLng
            });

            // Trigger manager checkout approval if applicable
            if (user.approving_manager_id) {
                await Approval.create({
                    attendance_log_id: activeLog.id,
                    manager_id: user.approving_manager_id,
                    status: 'pending'
                });
            }

            await logActivity({
                admin_id: user.staffid,
                action: 'WFH_CHECK_OUT',
                entity: 'AttendanceLog',
                entity_id: activeLog.id,
                affected_user_id: user.staffid,
                description: `Remote WFH Check-Out by ${user.firstname} ${user.lastname} (${durationText || 'completed'})`,
                ip_address: clientIp,
                user_agent: userAgent
            });

            return res.status(200).send({
                success: true,
                type: 'CHECK_OUT',
                todayStatus: 'COMPLETED',
                message: `WFH Check-Out recorded successfully. Total time: ${durationText || 'completed'}.`,
                timestamp: formattedNowTime,
                time: displayTime,
                checkOutTime: displayTime,
                duration: durationText,
                log: activeLog
            });
        }

    } catch (err) {
        console.error("Error in wfhPunch:", err);
        return res.status(500).send({
            success: false,
            message: err.message || "Failed to process WFH attendance punch."
        });
    }
};

exports.checkUserWfhToday = checkUserWfhToday;

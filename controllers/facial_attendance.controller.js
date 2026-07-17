const db = require("../models");
const User = db.user;
const EmployeeProfile = db.employee_profiles;
const AttendanceLog = db.attendance_logs;
const Approval = db.approvals;
const Setting = db.settings;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const timezoneUtil = require("../utils/timezone.util");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

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
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
        sum += Math.pow(arr1[i] - arr2[i], 2);
    }
    return Math.sqrt(sum);
};

/**
 * Register employee face descriptor and optional photo
 * POST /api/attendance/register-face (Self-service)
 * POST /api/admin/users/:id/register-face (Admin/HR)
 */
exports.registerFace = async (req, res) => {
    const userId = req.params.id || req.userId;
    const { faceDescriptor, faceDescriptorLeft, faceDescriptorRight, profileImage } = req.body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
        return res.status(400).send({
            message: "A valid 128-dimensional face descriptor array is required."
        });
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send({ message: "Employee not found." });
        }

        // Prevent the same face from being registered for more than one employee.
        // Compare the incoming descriptor against every OTHER user's registered face.
        const DUPLICATE_THRESHOLD = 0.5;
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
 * Identify an employee by face descriptor alone (no password needed)
 * POST /api/attendance/identify-face
 * Returns: { matched: true, email, employeeName } or { matched: false }
 */
exports.identifyFace = async (req, res) => {
    try {
        const { faceDescriptor } = req.body;

        if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
            return res.status(400).send({ matched: false, message: "Face descriptor is required." });
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

        let bestMatch = null;
        let bestDistance = Infinity;
        const threshold = 0.6;

        for (const user of users) {
            try {
                const storedDescriptor = JSON.parse(user.face_descriptor);
                const distance = getEuclideanDistance(faceDescriptor, storedDescriptor);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = user;
                }
            } catch (parseErr) {
                // Skip users with invalid descriptor data
                continue;
            }
        }

        if (bestMatch && bestDistance < threshold) {
            return res.status(200).send({
                matched: true,
                email: bestMatch.email,
                employeeName: `${bestMatch.firstname} ${bestMatch.lastname}`,
                distance: bestDistance
            });
        }

        return res.status(200).send({ matched: false, message: "Face not recognized." });

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
            return res.status(200).send({ status: 'CHECKED_IN', employeeName: `${user.firstname} ${user.lastname}` });
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
    const { email, password, faceDescriptor, faceDescriptorLeft, faceDescriptorRight, snapshotImage, latitude, longitude, phone_model, action, livenessVerified } = req.body;

    if (!email || (!password && !livenessVerified) || !faceDescriptor) {
        return res.status(400).send({
            message: "Email, password/liveness, and face descriptor are required."
        });
    }

    if (!action || !['CHECK_IN', 'CHECK_OUT'].includes(action)) {
        return res.status(400).send({
            message: "Action must be either 'CHECK_IN' or 'CHECK_OUT'."
        });
    }

    try {
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

        // Compare Left Profile if provided and registered
        if (faceDescriptorLeft && user.face_descriptor_left) {
            try {
                const storedLeft = JSON.parse(user.face_descriptor_left);
                const distanceLeft = getEuclideanDistance(faceDescriptorLeft, storedLeft);
                if (distanceLeft >= threshold) {
                    return res.status(400).send({
                        success: false,
                        message: "Left profile verification failed. Face does not match."
                    });
                }
            } catch (err) {
                // ignore parsing error
            }
        }

        // Compare Right Profile if provided and registered
        if (faceDescriptorRight && user.face_descriptor_right) {
            try {
                const storedRight = JSON.parse(user.face_descriptor_right);
                const distanceRight = getEuclideanDistance(faceDescriptorRight, storedRight);
                if (distanceRight >= threshold) {
                    return res.status(400).send({
                        success: false,
                        message: "Right profile verification failed. Face does not match."
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
 * Update an attendance log (Edit check-in, check-out times, or manually add check-out)
 * PUT /api/admin/attendance-logs/:id
 */
exports.updateAttendanceLog = async (req, res) => {
    try {
        const { check_in_time, check_out_time, date } = req.body;
        const logId = req.params.id;

        const log = await AttendanceLog.findByPk(logId, {
            include: [{ model: User, as: 'user' }]
        });

        if (!log) {
            return res.status(404).send({ message: "Attendance log not found." });
        }

        const oldValues = {
            check_in_time: log.check_in_time,
            check_out_time: log.check_out_time,
            date: log.date
        };

        const updateData = {};
        if (date) updateData.date = date;
        
        // Parse date times if provided
        if (check_in_time) {
            updateData.check_in_time = new Date(check_in_time);
        }
        
        if (check_out_time) {
            updateData.check_out_time = new Date(check_out_time);
        } else if (check_out_time === null || check_out_time === "") {
            updateData.check_out_time = null;
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



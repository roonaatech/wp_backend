const db = require("../models");
const OnDutyLog = db.on_duty_logs;
const User = db.user;
const Approval = db.approvals;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const emailService = require("../utils/email.service");
const timezoneUtil = require("../utils/timezone.util");
const Setting = db.settings;

// Helper to get application timezone
const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata'; // Default to IST per user requirement
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

// Helper to format date as dd-MM-yyyy HH:mm
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
};


// Start on-duty visit
exports.startOnDuty = async (req, res) => {
    const { client_name, location, purpose, latitude, longitude } = req.body;

    // Validate required fields
    if (!client_name || !location || !purpose) {
        return res.status(400).send({ message: "Client name, location, and purpose are required" });
    }

    const tz = await getAppTimezone();
    const nowString = timezoneUtil.getNowStringInTimezone(tz);

    OnDutyLog.create({
        staff_id: req.userId,
        client_name: client_name,
        location: location,
        purpose: purpose,
        start_lat: latitude,
        start_long: longitude,
        start_time: nowString,
        end_time: null
    })
        .then(async (onDuty) => {
            // Log activity
            await logActivity({
                admin_id: req.userId,
                action: 'CREATE',
                entity: 'OnDutyLog',
                entity_id: onDuty.id,
                affected_user_id: req.userId,
                description: `Started on-duty visit at ${client_name}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            res.status(200).send({
                message: "On-duty started successfully",
                data: onDuty
            });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

// End on-duty visit
exports.endOnDuty = (req, res) => {
    const { latitude, longitude } = req.body;

    // Find the active on-duty visit
    OnDutyLog.findOne({
        where: {
            staff_id: req.userId,
            end_time: null
        },
        order: [['start_time', 'DESC']]
    })
        .then(async onDuty => {
            if (!onDuty) {
                return res.status(404).send({ message: "No active on-duty visit found" });
            }

            const tz = await getAppTimezone();
            const nowString = timezoneUtil.getNowStringInTimezone(tz);

            // Update the on-duty record with end time
            return onDuty.update({
                end_time: nowString,
                end_lat: latitude,
                end_long: longitude,
                status: 'Pending'
            });
        })
        .then(async (updatedOnDuty) => {
            try {
                console.log('\n=== EndOnDuty - Creating Approval ===');
                console.log('Staff ID:', req.userId);
                console.log('On-Duty Log ID:', updatedOnDuty.id);

                // Get timezone to format times correctly
                const tz = await getAppTimezone();

                // Helper to format Date in app timezone as YYYY-MM-DD HH:mm:ss
                const formatDateInTimezone = (dateObj) => {
                    if (!dateObj) return null;
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

                    const parts = formatter.formatToParts(dateObj);
                    const p = {};
                    parts.forEach(part => { p[part.type] = part.value; });
                    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
                };

                // Log activity
                await logActivity({
                    admin_id: req.userId,
                    action: 'UPDATE',
                    entity: 'OnDutyLog',
                    entity_id: updatedOnDuty.id,
                    affected_user_id: req.userId,
                    description: `Ended on-duty visit at ${updatedOnDuty.client_name}`,
                    ip_address: getClientIp(req),
                    user_agent: getUserAgent(req)
                });

                // Get the staff member's approving_manager_id
                const staff = await User.findByPk(req.userId);

                console.log('Staff found:', !!staff);
                console.log('Staff name:', staff?.firstname, staff?.lastname);
                console.log('Staff role:', staff?.role);
                console.log('Approving Manager ID:', staff?.approving_manager_id);

                let manager = null;
                if (staff && staff.approving_manager_id) {
                    // Create approval record for on-duty
                    const approval = await Approval.create({
                        on_duty_log_id: updatedOnDuty.id,
                        manager_id: staff.approving_manager_id,
                        status: 'pending'
                    });
                    console.log('✅ Approval created successfully');

                    // Send Email to Manager
                    try {
                        manager = await User.findByPk(staff.approving_manager_id);
                        if (manager && manager.email) {
                            emailService.sendTemplateEmail(manager.email, "onduty_applied", {
                                user_name: `${staff.firstname} ${staff.lastname}`,
                                start_date: formatDate(updatedOnDuty.start_time),
                                end_date: formatDate(updatedOnDuty.end_time),
                                reason: `${updatedOnDuty.purpose} at ${updatedOnDuty.client_name}`
                            });
                        }
                    } catch (emailErr) {
                        console.error("Failed to send email:", emailErr);
                    }

                } else {
                    console.log('⚠️  Staff has no approving_manager_id - approval NOT created');
                }

                // Send Confirmation Email to Applicant
                try {
                    if (staff && staff.email) {
                        console.log('--- Email Trigger: On-Duty Confirmation ---');
                        console.log(`Sending onduty_applied_confirmation email to ${staff.email}`);

                        // Get manager email for CC if available
                        const managerEmail = (manager && manager.email) ? manager.email : null;

                        const result = await emailService.sendTemplateEmail(staff.email, "onduty_applied_confirmation", {
                            user_name: `${staff.firstname} ${staff.lastname}`,
                            start_date: formatDate(updatedOnDuty.start_time),
                            end_date: formatDate(updatedOnDuty.end_time),
                            client_name: updatedOnDuty.client_name,
                            reason: updatedOnDuty.purpose
                        }, managerEmail);
                        console.log('Confirmation email result:', result);
                    } else {
                        console.log('Applicant has no email or not found.');
                    }
                } catch (emailErr) {
                    console.error("Failed to send confirmation email:", emailErr);
                }

                console.log('=== EndOnDuty Complete ===\n');

                // Format the response with timezone-aware time strings
                const formattedData = {
                    ...updatedOnDuty.toJSON(),
                    start_time: formatDateInTimezone(updatedOnDuty.start_time),
                    end_time: formatDateInTimezone(updatedOnDuty.end_time)
                };

                res.status(200).send({
                    message: "On-duty ended successfully",
                    data: formattedData
                });
            } catch (err) {
                console.error('❌ Error creating approval:', err.message);
                console.error(err.stack);

                // Format the response even in error case
                const tz = await getAppTimezone();

                const formatDateInTimezone = (dateObj) => {
                    if (!dateObj) return null;
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

                    const parts = formatter.formatToParts(dateObj);
                    const p = {};
                    parts.forEach(part => { p[part.type] = part.value; });
                    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
                };

                const formattedData = {
                    ...updatedOnDuty.toJSON(),
                    start_time: formatDateInTimezone(updatedOnDuty.start_time),
                    end_time: formatDateInTimezone(updatedOnDuty.end_time)
                };

                // Still send success response even if approval creation fails
                res.status(200).send({
                    message: "On-duty ended successfully",
                    data: formattedData
                });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

// Get active on-duty visit for the current user
exports.getActiveOnDuty = async (req, res) => {
    try {
        const onDuty = await OnDutyLog.findOne({
            where: {
                staff_id: req.userId,
                end_time: null // Only get visits that haven't ended
            },
            order: [['start_time', 'DESC']]
        });

        if (!onDuty) {
            return res.status(200).send({ active: false });
        }

        // Get timezone to format times correctly
        const tz = await getAppTimezone();

        // Helper to format Date in app timezone as YYYY-MM-DD HH:mm:ss
        const formatDateInTimezone = (dateObj) => {
            if (!dateObj) return null;
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

            const parts = formatter.formatToParts(dateObj);
            const p = {};
            parts.forEach(part => { p[part.type] = part.value; });
            return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
        };

        // Format the response with timezone-aware time strings
        const formattedData = {
            ...onDuty.toJSON(),
            start_time: formatDateInTimezone(onDuty.start_time),
            end_time: formatDateInTimezone(onDuty.end_time)
        };

        res.status(200).send({
            active: true,
            data: formattedData
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get On-Duty Logs by Status (for manager/admin approvals)
exports.getOnDutyByStatus = async (req, res) => {
    try {
        const { Op } = require("sequelize");
        const User = db.user;
        const Role = db.roles;

        // Get status from query, default to 'Pending'
        const status = req.query.status || 'Pending';

        // Get current user's role to determine filtering
        const currentUser = await User.findByPk(req.userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Check if user has any on-duty approval permission
        if (!userRole || userRole.can_approve_onduty === 'none') {
            return res.status(403).send({
                message: "You don't have permission to view on-duty requests."
            });
        }

        const canApproveAllOnDuty = userRole.can_approve_onduty === 'all';

        // If user can only approve subordinates, get their reportees
        let reporteeIds = [];
        if (!canApproveAllOnDuty) {
            const reportees = await User.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        // For 'Pending', we only want completed visits (end_time not null)
        // For 'Approved' or 'Rejected', we want all matching that status
        let where = { status: status };
        if (status === 'Pending') {
            where.end_time = { [Op.ne]: null };
        }

        // Add filtering based on permission level
        if (!canApproveAllOnDuty && reporteeIds.length > 0) {
            where.staff_id = { [Op.in]: reporteeIds };
        } else if (!canApproveAllOnDuty) {
            // User with no reportees, return empty
            return res.status(200).send({ items: [] });
        }

        const onDutyLogs = await OnDutyLog.findAll({
            where: where,
            include: [{
                model: User,
                as: 'user',
                attributes: ['staffid', 'firstname', 'lastname', 'email']
            }],
            order: [['start_time', 'DESC']]
        });

        // Get timezone to format times correctly
        const tz = await getAppTimezone();

        // Helper to format Date in app timezone as YYYY-MM-DD HH:mm:ss
        const formatDateInTimezone = (dateObj) => {
            if (!dateObj) return null;
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

            const parts = formatter.formatToParts(dateObj);
            const p = {};
            parts.forEach(part => { p[part.type] = part.value; });
            return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
        };

        // Format the response
        const formattedLogs = onDutyLogs.map(log => ({
            id: log.id,
            staff_id: log.staff_id,
            client_name: log.client_name,
            location: log.location,
            purpose: log.purpose,
            start_time: formatDateInTimezone(log.start_time),
            end_time: formatDateInTimezone(log.end_time),
            status: log.status,
            rejection_reason: log.rejection_reason,
            manager_id: log.manager_id,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
            tblstaff: log.user
        }));

        res.status(200).send({
            items: formattedLogs
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get all currently active on-duty records (admin/manager view)
exports.getAllActiveOnDuty = async (req, res) => {
    try {
        const { Op } = require("sequelize");
        const User = db.user;
        const Role = db.roles;

        // Get current user's role to determine filtering
        const currentUser = await User.findByPk(req.userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        const canManageAllActiveOnDuty = userRole && userRole.can_manage_active_onduty === 'all';

        // If user can only view subordinates, get their reportees
        let reporteeIds = [];
        if (!canManageAllActiveOnDuty) {
            const reportees = await User.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        // Find all active on-duty records (end_time is null)
        let where = { end_time: null };

        // Add filtering based on permission level
        if (!canManageAllActiveOnDuty && reporteeIds.length > 0) {
            where.staff_id = { [Op.in]: reporteeIds };
        } else if (!canManageAllActiveOnDuty) {
            // User with no reportees, return empty
            return res.status(200).send({ items: [] });
        }

        const activeOnDutyLogs = await OnDutyLog.findAll({
            where: where,
            include: [{
                model: User,
                as: 'user',
                attributes: ['staffid', 'firstname', 'lastname', 'email']
            }],
            order: [['start_time', 'DESC']]
        });

        // Get timezone to format times correctly
        const tz = await getAppTimezone();

        // Helper to format Date in app timezone as YYYY-MM-DD HH:mm:ss
        const formatDateInTimezone = (dateObj) => {
            if (!dateObj) return null;
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

            const parts = formatter.formatToParts(dateObj);
            const p = {};
            parts.forEach(part => { p[part.type] = part.value; });
            return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
        };

        // Format the response
        const formattedLogs = activeOnDutyLogs.map(log => ({
            id: log.id,
            staff_id: log.staff_id,
            client_name: log.client_name,
            location: log.location,
            purpose: log.purpose,
            start_time: formatDateInTimezone(log.start_time),
            end_time: formatDateInTimezone(log.end_time),
            status: log.status,
            start_lat: log.start_lat,
            start_long: log.start_long,
            end_lat: log.end_lat,
            end_long: log.end_long,
            rejection_reason: log.rejection_reason,
            manager_id: log.manager_id,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
            tblstaff: log.user
        }));

        res.status(200).send({
            items: formattedLogs
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Update On-Duty Details (User Edit)
exports.updateOnDutyDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { client_name, location, purpose } = req.body;

        const log = await OnDutyLog.findByPk(id);
        if (!log) {
            return res.status(404).send({ message: "On-Duty log not found." });
        }

        // Only allow editing if Pending
        if (log.status !== 'Pending') {
            return res.status(400).send({ message: "Cannot edit a request that is already processed (Approved/Rejected)." });
        }

        // Allow editing by the owner only
        if (log.staff_id !== req.userId) {
            return res.status(403).send({ message: "Unauthorized to edit this request." });
        }

        if (client_name) log.client_name = client_name;
        if (location) log.location = location;
        if (purpose) log.purpose = purpose;

        await log.save();

        res.status(200).send({ message: "On-Duty details updated successfully!", log });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Delete On-Duty Log (User Delete)
exports.deleteOnDuty = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const requestId = parseInt(id, 10);
        if (isNaN(requestId)) {
            return res.status(400).send({ message: "Invalid request ID format." });
        }

        const onDutyLog = await OnDutyLog.findOne({
            where: { id: requestId, staff_id: userId }
        });

        if (!onDutyLog) {
            return res.status(404).send({ message: "On-duty request not found." });
        }

        // Allow deletion if status is null, empty, or 'Pending' (case-insensitive)
        const status = (onDutyLog.status || '').toLowerCase();
        if (status !== '' && status !== 'pending') {
            return res.status(403).send({ message: "Cannot delete a request that has already been processed." });
        }

        await onDutyLog.destroy();

        await logActivity({
            admin_id: userId,
            action: 'DELETE',
            entity: 'OnDutyLog',
            entity_id: requestId,
            affected_user_id: userId,
            description: `Deleted on-duty request ID: ${requestId}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        return res.status(200).send({ message: "On-duty request deleted successfully." });
    } catch (error) {
        console.error(`Error deleting on-duty request:`, error);
        res.status(500).send({ message: "Error deleting on-duty request.", error: error.message });
    }
};

// Update On-Duty Status (Approve/Reject)
exports.updateOnDutyStatus = async (req, res) => {
    try {
        const OnDutyLog = db.on_duty_logs;
        const { id } = req.params;
        const { status, rejection_reason } = req.body;

        const log = await OnDutyLog.findByPk(id);
        if (!log) {
            return res.status(404).send({ message: "On-Duty log not found." });
        }

        const oldStatus = log.status;
        const oldReason = log.rejection_reason;

        console.log(`[DEBUG] Updating On-Duty ID: ${id} to Status: ${status}`);

        // If only rejection_reason is being updated (no status change)
        if (!status && rejection_reason !== undefined) {
            // Only allow updating rejection reason if the request is already rejected
            if (log.status !== 'Rejected') {
                return res.status(400).send({ message: "Can only update rejection reason for rejected requests." });
            }

            // Only the person who rejected it can edit the reason
            if (Number(log.manager_id) !== Number(req.userId)) {
                return res.status(403).send({ message: "Only the person who rejected this request can edit the rejection reason." });
            }

            log.rejection_reason = rejection_reason;
            await log.save();

            // Log activity as UPDATE action
            await logActivity({
                admin_id: req.userId,
                action: 'UPDATE',
                entity: 'OnDutyLog',
                entity_id: log.id,
                affected_user_id: log.staff_id,
                old_values: { rejection_reason: oldReason },
                new_values: { rejection_reason: rejection_reason },
                description: `Updated rejection reason for ${log.client_name}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            return res.status(200).send({
                message: 'Rejection reason updated successfully!',
                log
            });
        }

        // Standard status update logic
        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).send({ message: "Invalid status! Must be 'Approved', 'Rejected', or 'Pending'." });
        }

        log.status = status;

        if (status === 'Pending') {
            log.manager_id = null;
            log.rejection_reason = null;
        } else {
            log.manager_id = req.userId; // Approver ID
            if (status === 'Rejected') {
                log.rejection_reason = rejection_reason;
            } else { // If status is 'Approved'
                log.rejection_reason = null; // Ensure it's cleared if approved
            }
        }

        await log.save();

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: status === 'Approved' ? 'APPROVE' : (status === 'Rejected' ? 'REJECT' : 'UPDATE'),
            entity: 'OnDutyLog',
            entity_id: log.id,
            affected_user_id: log.staff_id,
            old_values: { status: oldStatus },
            new_values: { status: status, rejection_reason: rejection_reason || null },
            description: `${status === 'Approved' ? 'Approved' : (status === 'Rejected' ? 'Rejected' : 'Updated')} on-duty request for ${log.client_name}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        // Fetch approver details if approved/rejected
        let approver = null;
        if (log.manager_id) {
            const Staff = db.user;
            approver = await Staff.findByPk(log.manager_id, {
                attributes: ['staffid', 'firstname', 'lastname', 'email']
            });
        }

        // Send Email to User
        try {
            const user = await User.findByPk(log.staff_id);
            console.log(`[DEBUG] Applicant found for email? ${!!user} (ID: ${log.staff_id})`);

            if (user && user.email && (status === 'Approved' || status === 'Rejected')) {
                console.log(`--- Email Trigger: On-Duty ${status} ---`);
                console.log(`Sending email to ${user.email}`);
                const templateSlug = status === 'Approved' ? 'onduty_approved' : 'onduty_rejected';

                // Get manager email for CC if available
                const managerEmail = approver && approver.email ? approver.email : null;

                emailService.sendTemplateEmail(user.email, templateSlug, {
                    user_name: `${user.firstname} ${user.lastname}`,
                    start_date: formatDate(log.start_time),
                    end_date: formatDate(log.end_time),
                    rejection_reason: rejection_reason || ""
                }, managerEmail);
            } else if (!user) {
                console.log('[DEBUG] Applicant user not found by ID ' + log.staff_id);
            } else if (!user.email) {
                console.log('[DEBUG] Applicant user has no email.');
            } else {
                console.log(`[DEBUG] Email logic skipped. Status: ${status}`);
            }
        } catch (emailErr) {
            console.error("Failed to send email:", emailErr);
        }

        res.status(200).send({
            message: `On-Duty visit ${status} successfully!`,
            log,
            approver
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};


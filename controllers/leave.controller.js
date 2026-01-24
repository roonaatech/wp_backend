const db = require("../models");
const LeaveRequest = db.leave_requests;
const LeaveType = db.leave_types;
const OnDutyLog = db.on_duty_logs;
const Staff = db.user;
const { Op } = require("sequelize");
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

// Helper to calculate days excluding Sundays
const calculateLeaveDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return 0;
    }

    while (current <= end) {
        // Exclude Sunday (0)
        if (current.getDay() !== 0) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

// Apply for a Leave
exports.applyLeave = async (req, res) => {
    try {
        const { leave_type, start_date, end_date, reason } = req.body;

        if (!leave_type || !start_date || !end_date) {
            return res.status(400).send({ message: "Leave type, start date, and end date are required!" });
        }

        // --- Validate Leave Balance ---
        // 1. Check if leave type is assigned to user in user_leave_types
        const UserLeaveType = db.user_leave_types;
        const userLeaveType = await UserLeaveType.findOne({
            where: { user_id: req.userId },
            include: [{ model: LeaveType, as: 'leave_type', where: { name: leave_type } }]
        });

        // Skip check for "Loss of Pay"
        const isLossOfPay = leave_type.toLowerCase().includes('loss of pay');

        if (!isLossOfPay) {
            if (!userLeaveType) {
                return res.status(400).send({ message: `Leave type '${leave_type}' is not assigned to you. Please contact admin.` });
            }
            const allowedDays = userLeaveType.days_allowed || 0;
            const requestedDays = calculateLeaveDays(start_date, end_date);

            // 2. Get already used/pending days for this year
            const year = new Date(start_date).getFullYear();
            const usedLeaves = await LeaveRequest.findAll({
                where: {
                    staff_id: req.userId,
                    leave_type: leave_type,
                    status: { [Op.in]: ['Approved', 'Pending'] },
                    start_date: {
                        [Op.gte]: `${year}-01-01`,
                        [Op.lte]: `${year}-12-31`
                    }
                }
            });

            let usedDaysCount = 0;
            usedLeaves.forEach(leave => {
                usedDaysCount += calculateLeaveDays(leave.start_date, leave.end_date);
            });

            const totalProjectedDays = usedDaysCount + requestedDays;

            if (totalProjectedDays > allowedDays) {
                return res.status(400).send({
                    message: `Leave limit exceeded! You have used ${usedDaysCount} days of ${leave_type}. Applying for ${requestedDays} more days would exceed the annual limit of ${allowedDays} days.`
                });
            }
        }
        // -----------------------------


        // Check for overlapping leaves (Pending, Approved, or Active)
        const overlappingLeave = await LeaveRequest.findOne({
            where: {
                staff_id: req.userId,
                status: { [Op.in]: ['Pending', 'Approved'] },
                [Op.or]: [
                    // New leave starts during existing leave
                    {
                        start_date: { [Op.lte]: start_date },
                        end_date: { [Op.gte]: start_date }
                    },
                    // New leave ends during existing leave
                    {
                        start_date: { [Op.lte]: end_date },
                        end_date: { [Op.gte]: end_date }
                    },
                    // New leave completely contains existing leave
                    {
                        start_date: { [Op.gte]: start_date },
                        end_date: { [Op.lte]: end_date }
                    }
                ]
            }
        });

        if (overlappingLeave) {
            return res.status(409).send({
                message: `You already have a leave application from ${overlappingLeave.start_date} to ${overlappingLeave.end_date} that overlaps with the selected dates.`,
                conflictingLeave: {
                    id: overlappingLeave.id,
                    start_date: overlappingLeave.start_date,
                    end_date: overlappingLeave.end_date,
                    status: overlappingLeave.status
                }
            });
        }

        const leave = await LeaveRequest.create({
            staff_id: req.userId,
            leave_type,
            start_date,
            end_date,
            reason
        });

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: 'CREATE',
            entity: 'LeaveRequest',
            entity_id: leave.id,
            affected_user_id: req.userId,
            description: `Applied for ${leave_type} leave from ${start_date} to ${end_date}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(201).send({ message: "Leave applied successfully!", leave });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get My Leaves (History)
exports.getMyLeaves = async (req, res) => {
    try {
        const OnDutyLog = db.on_duty_logs;
        const Staff = db.user;

        // Fetch Leaves
        const leaves = await LeaveRequest.findAll({
            where: { staff_id: req.userId },
            attributes: ['id', 'leave_type', 'start_date', 'end_date', 'reason', 'status', 'rejection_reason', 'manager_id', 'createdAt'],
            raw: true
        });

        // Fetch On-Duty Logs
        const onDutyLogs = await OnDutyLog.findAll({
            where: { staff_id: req.userId },
            attributes: ['id', 'client_name', 'location', 'purpose', 'start_time', 'end_time', 'status', 'rejection_reason', 'manager_id'],
            raw: true
        });

        // Helper function to ensure numeric types
        const ensureNumeric = (obj, fields) => {
            const result = { ...obj };
            fields.forEach(field => {
                if (result[field] !== null && result[field] !== undefined) {
                    result[field] = +result[field]; // Unary plus operator converts to number
                }
            });
            return result;
        };

        // Normalize and combine
        const normalizedLeaves = leaves.map(l =>
            ensureNumeric({
                type: 'leave',
                id: l.id,
                title: l.leave_type,
                subtitle: l.reason,
                status: l.status,
                start: l.start_date,
                end: l.end_date,
                rejection_reason: l.rejection_reason,
                manager_id: l.manager_id,
                date: l.createdAt
            }, ['id', 'manager_id'])
        );

        const normalizedOnDuty = onDutyLogs.map(l =>
            ensureNumeric({
                type: 'on_duty',
                id: l.id,
                title: `On-Duty: ${l.client_name}`,
                subtitle: `${l.location} - ${l.purpose}`,
                status: !l.end_time ? 'Active' : (l.status || 'Pending'),
                start: l.start_time,
                end: l.end_time,
                rejection_reason: l.rejection_reason,
                manager_id: l.manager_id,
                date: l.start_time
            }, ['id', 'manager_id'])
        );

        const combined = [...normalizedLeaves, ...normalizedOnDuty];

        // Fetch approver details for approved/rejected items
        for (let item of combined) {
            if (item.manager_id) {
                const approver = await Staff.findByPk(item.manager_id, {
                    attributes: ['staffid', 'firstname', 'lastname', 'email']
                });
                item.approver = approver;
            }
        }

        // Sort by date descending
        combined.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).send({ items: combined });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get Pending Requests (Leaves & Completed On-Duty)
exports.getPendingLeaves = async (req, res) => {
    try {
        const OnDutyLog = db.on_duty_logs;
        const { Op } = require("sequelize");

        // Get current user's role to determine filtering
        const currentUser = await Staff.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // If manager, get their reportees
        let reporteeIds = [];
        if (!isAdmin) {
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
            if (reporteeIds.length === 0) {
                return res.status(200).send({ items: [] });
            }
        }

        // Build where clause for leaves
        let leaveWhere = { status: 'Pending' };
        if (!isAdmin) {
            leaveWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Fetch Pending Leaves
        const leaves = await LeaveRequest.findAll({
            where: leaveWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['firstname', 'lastname', 'email']
            }],
            order: [['createdAt', 'ASC']]
        });

        // Build where clause for on-duty
        let onDutyWhere = {
            status: 'Pending',
            end_time: { [Op.ne]: null } // Only completed visits
        };
        if (!isAdmin) {
            onDutyWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Fetch Pending Completed On-Duty Logs (End time is not null, Status is Pending)
        const onDutyLogs = await OnDutyLog.findAll({
            where: onDutyWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['firstname', 'lastname', 'email']
            }],
            order: [['start_time', 'ASC']]
        });

        // Normalize and combine
        const normalizedLeaves = leaves.map(l => ({
            type: 'leave',
            id: l.id,
            staff_id: l.staff_id,
            tblstaff: l.user,
            title: l.leave_type,
            reason: l.reason,
            start_date: l.start_date,
            end_date: l.end_date,
            createdAt: l.createdAt
        }));

        const normalizedOnDuty = onDutyLogs.map(l => ({
            type: 'on_duty',
            id: l.id,
            staff_id: l.staff_id,
            tblstaff: l.user,
            title: `On-Duty: ${l.client_name}`,
            reason: `${l.purpose} (${l.location})`,
            start_date: l.start_time,
            end_date: l.end_time,
            createdAt: l.start_time
        }));

        const combined = [...normalizedLeaves, ...normalizedOnDuty];
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        res.status(200).send({ items: combined });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get Manageable Requests (Filtered by Status)
exports.getManageableRequests = async (req, res) => {
    try {
        const OnDutyLog = db.on_duty_logs;
        const { Op } = require("sequelize");

        // Get status from query, default to 'Pending'
        const status = req.query.status || 'Pending';

        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Get current user's role to determine filtering
        const currentUser = await Staff.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // If manager, get their reportees
        let reporteeIds = [];
        if (!isAdmin) {
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: {
                    approving_manager_id: req.userId
                },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
            console.log(`Manager ${req.userId} - filtering by reportees:`, reporteeIds);
        }

        // Build where clause for leaves
        let leaveWhere = { status: status };
        if (!isAdmin && reporteeIds.length > 0) {
            leaveWhere.staff_id = { [Op.in]: reporteeIds };
        } else if (!isAdmin && reporteeIds.length === 0) {
            // Manager has no reportees, return empty
            return res.status(200).send({
                items: [],
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalCount: 0,
                    totalPages: 0,
                    leaveCount: 0,
                    onDutyCount: 0,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            });
        }

        // Fetch Leaves with pagination
        const leaves = await LeaveRequest.findAll({
            where: leaveWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['firstname', 'lastname', 'email']
            }],
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: (page - 1) * limit
        });

        // Get total count of leaves
        const totalLeaveCount = await LeaveRequest.count({
            where: leaveWhere
        });

        // Build where clause for on-duty logs
        let onDutyWhere = { status: status };
        if (status === 'Pending') {
            onDutyWhere.end_time = { [Op.ne]: null };
        }
        if (!isAdmin && reporteeIds.length > 0) {
            onDutyWhere.staff_id = { [Op.in]: reporteeIds };
        }

        const onDutyLogs = await OnDutyLog.findAll({
            where: onDutyWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['firstname', 'lastname', 'email']
            }],
            order: [['start_time', 'DESC']],
            limit: limit,
            offset: (page - 1) * limit
        });

        // Get total count of on-duty logs
        const totalOnDutyCount = await OnDutyLog.count({
            where: onDutyWhere
        });

        // Normalize leaves
        const normalizedLeaves = leaves.map(l => {
            return {
                type: 'leave',
                id: l.id,
                staff_id: l.staff_id,
                tblstaff: l.user,
                title: l.leave_type,
                reason: l.reason,
                start_date: l.start_date,
                end_date: l.end_date,
                status: l.status,
                rejection_reason: l.rejection_reason,
                manager_id: l.manager_id,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt
            };
        });

        // Normalize on-duty logs
        const normalizedOnDuty = onDutyLogs.map(l => {
            return {
                type: 'on_duty',
                id: l.id,
                staff_id: l.staff_id,
                tblstaff: l.user,
                title: `On-Duty: ${l.client_name}`,
                reason: `${l.purpose} (${l.location})`,
                start_date: l.start_time,
                end_date: l.end_time,
                status: l.status,
                rejection_reason: l.rejection_reason,
                manager_id: l.manager_id,
                createdAt: l.start_time,
                updatedAt: l.updatedAt
            };
        });

        // Combine paginated results
        const paginatedItems = [...normalizedLeaves, ...normalizedOnDuty];

        // Fetch approver details for approved/rejected items
        for (let item of paginatedItems) {
            if (item.manager_id) {
                const approver = await Staff.findByPk(item.manager_id, {
                    attributes: ['staffid', 'firstname', 'lastname', 'email']
                });
                item.approver = approver;
            }
        }

        // Calculate pagination based on leaves (or on-duty, both have same limit)
        const totalPages = Math.ceil(Math.max(totalLeaveCount, totalOnDutyCount) / limit);

        res.status(200).send({
            items: paginatedItems,
            pagination: {
                currentPage: page,
                pageSize: limit,
                totalCount: totalLeaveCount + totalOnDutyCount,
                totalPages: totalPages,
                leaveCount: totalLeaveCount,
                onDutyCount: totalOnDutyCount,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Update Leave Status (Approve/Reject)
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection_reason } = req.body;

        const leave = await LeaveRequest.findByPk(id);
        if (!leave) {
            return res.status(404).send({ message: "Leave request not found." });
        }

        const oldStatus = leave.status;
        const oldReason = leave.rejection_reason;

        // If only rejection_reason is being updated (no status change)
        if (!status && rejection_reason !== undefined) {
            // Only allow updating rejection reason if the request is already rejected
            if (leave.status !== 'Rejected') {
                return res.status(400).send({ message: "Can only update rejection reason for rejected requests." });
            }

            // Only the person who rejected it can edit the reason
            if (Number(leave.manager_id) !== Number(req.userId)) {
                return res.status(403).send({ message: "Only the person who rejected this request can edit the rejection reason." });
            }

            leave.rejection_reason = rejection_reason;
            await leave.save();

            // Log activity as UPDATE action
            await logActivity({
                admin_id: req.userId,
                action: 'UPDATE',
                entity: 'LeaveRequest',
                entity_id: leave.id,
                affected_user_id: leave.staff_id,
                old_values: { rejection_reason: oldReason },
                new_values: { rejection_reason: rejection_reason },
                description: `Updated rejection reason for ${leave.leave_type}`,
                ip_address: getClientIp(req),
                user_agent: getUserAgent(req)
            });

            return res.status(200).send({
                message: 'Rejection reason updated successfully!',
                leave
            });
        }

        // Standard status update logic
        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).send({ message: "Invalid status! Must be 'Approved', 'Rejected', or 'Pending'." });
        }

        leave.status = status;

        if (status === 'Pending') {
            leave.manager_id = null;
            leave.rejection_reason = null;
        } else {
            leave.manager_id = req.userId; // Approver ID
            if (status === 'Rejected') {
                leave.rejection_reason = rejection_reason;
            } else { // If status is 'Approved'
                leave.rejection_reason = null; // Ensure it's cleared if approved
            }
        }

        await leave.save();

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: status === 'Approved' ? 'APPROVE' : (status === 'Rejected' ? 'REJECT' : 'UPDATE'),
            entity: 'LeaveRequest',
            entity_id: leave.id,
            affected_user_id: leave.staff_id,
            old_values: { status: oldStatus },
            new_values: { status: status, rejection_reason: rejection_reason || null },
            description: `${status === 'Approved' ? 'Approved' : (status === 'Rejected' ? 'Rejected' : 'Updated')} leave request for ${leave.leave_type}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        // Fetch approver details if approved/rejected
        let approver = null;
        if (leave.manager_id) {
            const Staff = db.user;
            approver = await Staff.findByPk(leave.manager_id, {
                attributes: ['staffid', 'firstname', 'lastname', 'email']
            });
        }

        res.status(200).send({
            message: `Leave ${status} successfully!`,
            leave,
            approver
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Update Leave Details (User Edit)
exports.updateLeaveDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { leave_type, start_date, end_date, reason } = req.body;

        const leave = await LeaveRequest.findByPk(id);
        if (!leave) {
            return res.status(404).send({ message: "Leave request not found." });
        }

        // Only allow editing if Pending
        if (leave.status !== 'Pending') {
            return res.status(400).send({ message: "Cannot edit a request that is already processed (Approved/Rejected)." });
        }

        // Allow editing by the owner only
        if (leave.staff_id !== req.userId) {
            return res.status(403).send({ message: "Unauthorized to edit this request." });
        }

        // Check for overlapping leaves (excluding current leave being edited)
        if (start_date || end_date) {
            const checkStartDate = start_date || leave.start_date;
            const checkEndDate = end_date || leave.end_date;

            const overlappingLeave = await LeaveRequest.findOne({
                where: {
                    staff_id: req.userId,
                    id: { [Op.ne]: id }, // Exclude current leave
                    status: { [Op.in]: ['Pending', 'Approved'] },
                    [Op.or]: [
                        // New leave starts during existing leave
                        {
                            start_date: { [Op.lte]: checkStartDate },
                            end_date: { [Op.gte]: checkStartDate }
                        },
                        // New leave ends during existing leave
                        {
                            start_date: { [Op.lte]: checkEndDate },
                            end_date: { [Op.gte]: checkEndDate }
                        },
                        // New leave completely contains existing leave
                        {
                            start_date: { [Op.gte]: checkStartDate },
                            end_date: { [Op.lte]: checkEndDate }
                        }
                    ]
                }
            });

            if (overlappingLeave) {
                return res.status(409).send({
                    message: `You already have a leave application from ${overlappingLeave.start_date} to ${overlappingLeave.end_date} that overlaps with the selected dates.`,
                    conflictingLeave: {
                        id: overlappingLeave.id,
                        start_date: overlappingLeave.start_date,
                        end_date: overlappingLeave.end_date,
                        status: overlappingLeave.status
                    }
                });
            }
        }

        if (leave_type) leave.leave_type = leave_type;
        if (start_date) leave.start_date = start_date;
        if (end_date) leave.end_date = end_date;
        if (reason) leave.reason = reason;

        await leave.save();

        res.status(200).send({ message: "Leave request updated successfully!", leave });
    } catch (err) {
        res.status(500).send({ message: err.message });
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

        res.status(200).send({
            message: `On-Duty visit ${status} successfully!`,
            log,
            approver
        });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};

// Get Admin Stats
exports.getAdminStats = async (req, res) => {
    try {
        const OnDutyLog = db.on_duty_logs;
        const Staff = db.user;
        const { Op } = require("sequelize");

        // Get current user's role to determine filtering
        const currentUser = await Staff.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // If manager, get their reportees
        let reporteeIds = [];
        if (!isAdmin) {
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        // Build where clause
        let leaveWhere = {};
        let onDutyWhere = {};
        if (!isAdmin && reporteeIds.length > 0) {
            leaveWhere.staff_id = { [Op.in]: reporteeIds };
            onDutyWhere.staff_id = { [Op.in]: reporteeIds };
        } else if (!isAdmin) {
            // Manager with no reportees
            return res.status(200).send({
                pendingLeaves: 0,
                approvedLeaves: 0,
                rejectedLeaves: 0,
                pendingOnDuty: 0,
                approvedOnDuty: 0,
                rejectedOnDuty: 0,
                activeOnDuty: 0
            });
        }

        const pendingLeaves = await LeaveRequest.count({ where: { ...leaveWhere, status: 'Pending' } });
        const approvedLeaves = await LeaveRequest.count({ where: { ...leaveWhere, status: 'Approved' } });
        const rejectedLeaves = await LeaveRequest.count({ where: { ...leaveWhere, status: 'Rejected' } });

        // For on-duty: Pending means completed but awaiting approval (end_time is not null)
        const pendingOnDuty = await OnDutyLog.count({ where: { ...onDutyWhere, status: 'Pending', end_time: { [Op.ne]: null } } });
        const approvedOnDuty = await OnDutyLog.count({ where: { ...onDutyWhere, status: 'Approved' } });
        const rejectedOnDuty = await OnDutyLog.count({ where: { ...onDutyWhere, status: 'Rejected' } });
        const activeOnDuty = await OnDutyLog.count({ where: { ...onDutyWhere, end_time: null } });

        console.log('Dashboard stats:', { pendingLeaves, approvedLeaves, rejectedLeaves, pendingOnDuty, approvedOnDuty, rejectedOnDuty, activeOnDuty });

        res.status(200).send({
            pendingLeaves,
            approvedLeaves,
            rejectedLeaves,
            pendingOnDuty,
            approvedOnDuty,
            rejectedOnDuty,
            activeOnDuty
        });
    } catch (err) {
        console.error('Error in getAdminStats:', err);
        res.status(500).send({ message: err.message });
    }
};
// Get My Stats (For Mobile Dashboard)
exports.getMyStats = async (req, res) => {
    try {
        const OnDutyLog = db.on_duty_logs;
        const { Op } = require("sequelize");

        console.log('[getMyStats] Fetching stats for user:', req.userId);

        const pendingCount = await LeaveRequest.count({ where: { staff_id: req.userId, status: 'Pending' } });
        const approvedCount = await LeaveRequest.count({ where: { staff_id: req.userId, status: 'Approved' } });
        const rejectedCount = await LeaveRequest.count({ where: { staff_id: req.userId, status: 'Rejected' } });
        const totalLeaves = await LeaveRequest.count({ where: { staff_id: req.userId } });

        console.log('[getMyStats] Leave counts - Total:', totalLeaves, 'Pending:', pendingCount, 'Approved:', approvedCount, 'Rejected:', rejectedCount);

        const rejectedOnDutyCount = await OnDutyLog.count({ where: { staff_id: req.userId, status: 'Rejected' } });
        const approvedOnDutyCount = await OnDutyLog.count({ where: { staff_id: req.userId, status: 'Approved' } });
        const onDutyCount = await OnDutyLog.count({ where: { staff_id: req.userId } });
        const activeOnDutyCount = await OnDutyLog.count({ where: { staff_id: req.userId, end_time: null } });

        console.log('[getMyStats] OnDuty counts - Total:', onDutyCount, 'Active:', activeOnDutyCount, 'Approved:', approvedOnDutyCount, 'Rejected:', rejectedOnDutyCount);

        const pendingOnDutyCount = await OnDutyLog.count({
            where: {
                staff_id: req.userId,
                status: 'Pending',
                end_time: { [Op.ne]: null }
            }
        });

        console.log('[getMyStats] Pending OnDuty:', pendingOnDutyCount);

        const stats = {
            totalLeaves: totalLeaves,
            pendingLeaves: pendingCount + pendingOnDutyCount,
            approvedLeaves: approvedCount + approvedOnDutyCount,
            rejectedLeaves: rejectedCount + rejectedOnDutyCount,
            activeOnDuty: activeOnDutyCount,
            onDutyLeaves: onDutyCount
        };

        console.log('[getMyStats] Final stats:', JSON.stringify(stats));
        res.status(200).send(stats);
    } catch (err) {
        console.error('[getMyStats Error]:', err);
        res.status(500).send({ message: err.message });
    }
};

// Delete Leave Request
exports.deleteLeave = async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        const requestId = parseInt(id, 10);
        if (isNaN(requestId)) {
            return res.status(400).send({ message: "Invalid request ID format." });
        }

        // Try to find and delete leave request first
        const leaveRequest = await LeaveRequest.findOne({
            where: { id: requestId, staff_id: userId }
        });

        if (leaveRequest) {
            if (leaveRequest.status !== 'Pending') {
                return res.status(403).send({ message: "Cannot delete a request that has already been processed." });
            }

            await leaveRequest.destroy();
            logActivity(req, `Deleted leave request ID: ${requestId}`);
            return res.status(200).send({ message: "Leave request deleted successfully." });
        }

        // If not a leave request, try to find and delete on-duty log
        const onDutyLog = await OnDutyLog.findOne({
            where: { id: requestId, staff_id: userId }
        });

        if (onDutyLog) {
            const status = (onDutyLog.status || '').toLowerCase();
            if (status !== '' && status !== 'pending') {
                return res.status(403).send({ message: "Cannot delete a request that has already been processed." });
            }

            await onDutyLog.destroy();
            logActivity(req, `Deleted on-duty request ID: ${requestId}`);
            return res.status(200).send({ message: "On-duty request deleted successfully." });
        }

        return res.status(404).send({ message: "Leave/On-Duty request not found." });

    } catch (error) {
        console.error(`Error deleting request:`, error);
        logActivity(req, `Error deleting request ID: ${id}`, error);
        res.status(500).send({ message: "Error deleting request.", error: error.message });
    }
};
// Get leave balance for a specific user
exports.getUserLeaveBalance = async (req, res) => {
    const { userId } = req.params;

    try {
        console.log(`[BALANCE] Fetching leave balance for user: ${userId}`);

        // Get user's gender
        const TblStaff = db.user;
        const user = await TblStaff.findByPk(userId);

        if (!user) {
            return res.status(404).send({
                message: "User not found."
            });
        }

        console.log(`[BALANCE] User gender: ${user.gender}`);

        const currentYear = new Date().getFullYear();
        const yearStart = new Date(`${currentYear}-01-01`);
        const yearEnd = new Date(`${currentYear}-12-31`);

        // Only consider leave types explicitly assigned to user in user_leave_types
        const LeaveType = db.leave_types;
        const UserLeaveType = db.user_leave_types;
        
        const assignedLeaveTypes = await UserLeaveType.findAll({
            where: { user_id: userId },
            include: [{ model: LeaveType, as: 'leave_type', where: { status: true } }]
        });

        const balances = [];
        for (const ult of assignedLeaveTypes) {
            const leaveType = ult.leave_type;
            
            // Check gender restriction
            if (leaveType.gender_restriction && leaveType.gender_restriction.length > 0 && !leaveType.gender_restriction.includes(user.gender)) {
                console.log(`[BALANCE] Skipping ${leaveType.name} due to gender restriction`);
                continue;
            }
            
            // Get approved/active/pending leaves for this user, leave type, and CURRENT YEAR only
            const usedLeaves = await LeaveRequest.findAll({
                where: {
                    staff_id: userId,
                    leave_type: leaveType.name,
                    status: { [Op.in]: ['Pending', 'Approved', 'Active'] },
                    start_date: {
                        [Op.gte]: yearStart,
                        [Op.lte]: yearEnd
                    }
                }
            });

            let daysUsed = 0;
            usedLeaves.forEach(leave => {
                const start = new Date(leave.start_date);
                const end = new Date(leave.end_date);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                daysUsed += days;
            });

            const balance = Math.max(0, ult.days_allowed - daysUsed);

            balances.push({
                id: leaveType.id,
                name: leaveType.name,
                total_days: ult.days_allowed,
                used: daysUsed,
                balance: balance
            });
            
            console.log(`[BALANCE] ${leaveType.name}: used=${daysUsed}, allowed=${ult.days_allowed}, balance=${balance}`);
        }

        res.status(200).send({
            leaveTypes: balances,
            year: currentYear
        });
    } catch (error) {
        console.error('[BALANCE] Error fetching user leave balance:', error);
        res.status(500).send({ message: "Error fetching leave balance.", error: error.message });
    }
};

// Get current user's leave balance (for mobile app)
exports.getMyLeaveBalance = async (req, res) => {
    try {
        const userId = req.userId;
        console.log(`[MY-BALANCE] Fetching leave balance for current user: ${userId}`);

        // Get user's gender
        const TblStaff = db.user;
        const user = await TblStaff.findByPk(userId);

        if (!user) {
            return res.status(404).send({
                message: "User not found."
            });
        }

        console.log(`[MY-BALANCE] User gender: ${user.gender}`);

        const currentYear = new Date().getFullYear();
        const yearStart = new Date(`${currentYear}-01-01`);
        const yearEnd = new Date(`${currentYear}-12-31`);

        // Only consider leave types assigned to user in user_leave_types
        const UserLeaveType = db.user_leave_types;
        const assignedLeaveTypes = await UserLeaveType.findAll({
            where: { user_id: userId },
            include: [{ model: LeaveType, as: 'leave_type', where: { status: true } }]
        });

        const balanceMap = {};
        for (const ult of assignedLeaveTypes) {
            const leaveType = ult.leave_type;
            // Gender restriction check
            if (leaveType.gender_restriction && leaveType.gender_restriction.length > 0 && !leaveType.gender_restriction.includes(user.gender)) {
                continue;
            }
            // Get approved/active leaves for this user, leave type, and CURRENT YEAR only
            const usedLeaves = await LeaveRequest.findAll({
                where: {
                    staff_id: userId,
                    leave_type: leaveType.name,
                    status: { [Op.in]: ['Pending', 'Approved', 'Active'] },
                    start_date: {
                        [Op.gte]: yearStart,
                        [Op.lte]: yearEnd
                    }
                }
            });
            // Calculate total days used
            let daysUsed = 0;
            usedLeaves.forEach(leave => {
                const start = new Date(leave.start_date);
                const end = new Date(leave.end_date);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                daysUsed += days;
            });
            const balance = Math.max(0, ult.days_allowed - daysUsed);
            balanceMap[leaveType.name] = balance;
            console.log(`[MY-BALANCE] ${leaveType.name}: balance=${balance}`);
        }
        res.status(200).send(balanceMap);
    } catch (error) {
        console.error('[MY-BALANCE] Error fetching user leave balance:', error);
        res.status(500).send({ message: "Error fetching leave balance.", error: error.message });
    }
};
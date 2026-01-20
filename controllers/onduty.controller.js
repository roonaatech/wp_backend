const db = require("../models");
const OnDutyLog = db.on_duty_logs;
const User = db.user;
const Approval = db.approvals;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

// Start on-duty visit
exports.startOnDuty = (req, res) => {
    const { client_name, location, purpose, latitude, longitude } = req.body;

    // Validate required fields
    if (!client_name || !location || !purpose) {
        return res.status(400).send({ message: "Client name, location, and purpose are required" });
    }

    OnDutyLog.create({
        staff_id: req.userId,
        client_name: client_name,
        location: location,
        purpose: purpose,
        start_lat: latitude,
        start_long: longitude,
        start_time: new Date(),
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
        .then(onDuty => {
            if (!onDuty) {
                return res.status(404).send({ message: "No active on-duty visit found" });
            }

            // Update the on-duty record with end time
            return onDuty.update({
                end_time: new Date(),
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

                if (staff && staff.approving_manager_id) {
                    // Create approval record for on-duty
                    const approval = await Approval.create({
                        on_duty_log_id: updatedOnDuty.id,
                        manager_id: staff.approving_manager_id,
                        status: 'pending'
                    });
                    console.log('✅ Approval created successfully');
                    console.log('   Approval ID:', approval.id);
                    console.log('   On-Duty Log ID:', approval.on_duty_log_id);
                    console.log('   Manager ID:', approval.manager_id);
                    console.log('   Status:', approval.status);
                } else {
                    console.log('⚠️  Staff has no approving_manager_id - approval NOT created');
                }

                console.log('=== EndOnDuty Complete ===\n');

                res.status(200).send({
                    message: "On-duty ended successfully",
                    data: updatedOnDuty
                });
            } catch (err) {
                console.error('❌ Error creating approval:', err.message);
                console.error(err.stack);
                // Still send success response even if approval creation fails
                res.status(200).send({
                    message: "On-duty ended successfully",
                    data: updatedOnDuty
                });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

// Get active on-duty visit for the current user
exports.getActiveOnDuty = (req, res) => {
    OnDutyLog.findOne({
        where: {
            staff_id: req.userId,
            end_time: null // Only get visits that haven't ended
        },
        order: [['start_time', 'DESC']]
    })
        .then(onDuty => {
            if (!onDuty) {
                return res.status(200).send({ active: false });
            }
            res.status(200).send({
                active: true,
                data: onDuty
            });
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

// Get On-Duty Logs by Status (for manager/admin approvals)
exports.getOnDutyByStatus = async (req, res) => {
    try {
        const { Op } = require("sequelize");
        const User = db.user;

        // Get status from query, default to 'Pending'
        const status = req.query.status || 'Pending';

        // Get current user's role to determine filtering
        const currentUser = await User.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // If manager, get their reportees
        let reporteeIds = [];
        if (!isAdmin) {
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

        // Add manager filtering
        if (!isAdmin && reporteeIds.length > 0) {
            where.staff_id = { [Op.in]: reporteeIds };
        } else if (!isAdmin) {
            // Manager with no reportees, return empty
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

        // Format the response
        const formattedLogs = onDutyLogs.map(log => ({
            id: log.id,
            staff_id: log.staff_id,
            client_name: log.client_name,
            location: log.location,
            purpose: log.purpose,
            start_time: log.start_time,
            end_time: log.end_time,
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

        // Get current user's role to determine filtering
        const currentUser = await User.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // If manager, get their reportees
        let reporteeIds = [];
        if (!isAdmin) {
            const reportees = await User.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        // Find all active on-duty records (end_time is null)
        let where = { end_time: null };

        // Add manager filtering
        if (!isAdmin && reporteeIds.length > 0) {
            where.staff_id = { [Op.in]: reporteeIds };
        } else if (!isAdmin) {
            // Manager with no reportees, return empty
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

        // Format the response
        const formattedLogs = activeOnDutyLogs.map(log => ({
            id: log.id,
            staff_id: log.staff_id,
            client_name: log.client_name,
            location: log.location,
            purpose: log.purpose,
            start_time: log.start_time,
            end_time: log.end_time,
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

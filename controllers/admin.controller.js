const db = require("../models");
const bcrypt = require("bcryptjs");
const TblStaff = db.user;
const OnDutyLog = db.on_duty_logs;
const Approval = db.approvals;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");

exports.createUser = async (req, res) => {
    const { firstname, lastname, email, password, role, approving_manager_id, gender } = req.body;

    // Validate input
    if (!firstname || !lastname || !email || !password || !role || !gender) {
        return res.status(400).send({
            message: "All fields (firstname, lastname, email, password, role, gender) are required."
        });
    }

    // Validate role and manager_id requirements
    if (role === 2 && !approving_manager_id) {
        return res.status(400).send({
            message: "Manager role requires an approving admin manager."
        });
    }

    try {
        // Check if email already exists
        const existingUser = await TblStaff.findOne({ where: { email: email } });
        if (existingUser) {
            return res.status(409).send({
                message: "Email already exists."
            });
        }

        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 8);

        // Create new user
        const newUser = await TblStaff.create({
            firstname: firstname,
            lastname: lastname,
            email: email,
            password: hashedPassword,
            role: parseInt(role),
            approving_manager_id: approving_manager_id ? parseInt(approving_manager_id) : null,
            gender: gender,
            active: 1
        });

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: 'CREATE',
            entity: 'User',
            entity_id: newUser.staffid,
            affected_user_id: newUser.staffid,
            description: `Created user account for ${newUser.firstname} ${newUser.lastname}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.status(201).send({
            message: "User created successfully.",
            user: {
                staffid: newUser.staffid,
                firstname: newUser.firstname,
                lastname: newUser.lastname,
                email: newUser.email,
                role: newUser.role,
                approving_manager_id: newUser.approving_manager_id,
                gender: newUser.gender,
                active: newUser.active
            }
        });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while creating user."
        });
    }
};

exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { firstname, lastname, email, password, role, approving_manager_id, gender } = req.body;

    // Validate input
    if (!firstname || !lastname || !email || !role) {
        return res.status(400).send({
            message: "Firstname, lastname, email, and role are required."
        });
    }

    // Validate role and manager_id requirements
    if (role === 2 && !approving_manager_id) {
        return res.status(400).send({
            message: "Manager role requires an approving admin manager."
        });
    }

    // Find user by ID
    TblStaff.findByPk(id)
        .then(user => {
            if (!user) {
                return res.status(404).send({
                    message: "User not found."
                });
            }

            // Check if new email is already used by another user
            if (email !== user.email) {
                TblStaff.findOne({ where: { email: email } })
                    .then(existingUser => {
                        if (existingUser) {
                            return res.status(409).send({
                                message: "Email already exists."
                            });
                        }
                        performUpdate();
                    })
                    .catch(err => {
                        return res.status(500).send({
                            message: err.message || "Error checking email."
                        });
                    });
            } else {
                performUpdate();
            }

            function performUpdate() {
                // Build update object
                const updateData = {
                    firstname: firstname,
                    lastname: lastname,
                    email: email,
                    role: parseInt(role),
                    approving_manager_id: approving_manager_id ? parseInt(approving_manager_id) : null,
                    gender: gender,
                    active: req.body.active !== undefined ? req.body.active : user.active
                };

                // Only update password if provided
                if (password) {
                    updateData.password = bcrypt.hashSync(password, 8);
                }

                // Update user
                user.update(updateData)
                    .then(updatedUser => {
                        res.send({
                            message: "User updated successfully.",
                            user: {
                                staffid: updatedUser.staffid,
                                firstname: updatedUser.firstname,
                                lastname: updatedUser.lastname,
                                email: updatedUser.email,
                                gender: updatedUser.gender,
                                role: updatedUser.role,
                                approving_manager_id: updatedUser.approving_manager_id,
                                active: updatedUser.active
                            }
                        });
                    })
                    .catch(err => {
                        res.status(500).send({
                            message: err.message || "Error updating user."
                        });
                    });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Error finding user."
            });
        });
};

// Reset user password (Admin only)
exports.resetUserPassword = async (req, res) => {
    try {
        const userId = req.params.id;
        const { newPassword } = req.body;

        // Verify admin permission
        const currentUser = await TblStaff.findByPk(req.userId);
        if (!currentUser || currentUser.role !== 1) {
            return res.status(403).send({
                message: "Access denied. Only admins can reset passwords."
            });
        }

        // Validate new password
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).send({
                message: "Password must be at least 6 characters long."
            });
        }

        // Find the user to update
        const user = await TblStaff.findByPk(userId);
        if (!user) {
            return res.status(404).send({
                message: "User not found."
            });
        }

        // Hash the new password
        const hashedPassword = bcrypt.hashSync(newPassword, 8);

        // Update the password
        await user.update({
            password: hashedPassword
        });

        // Log the activity
        await logActivity({
            admin_id: req.userId,
            action: 'PASSWORD_RESET',
            entity: 'User',
            entity_id: userId,
            affected_user_id: userId,
            description: `Admin ${currentUser.firstname} ${currentUser.lastname} reset password for ${user.firstname} ${user.lastname}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.send({
            message: "Password reset successfully."
        });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Error resetting password."
        });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        // Get current user's role to determine filtering
        const currentUser = await TblStaff.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // Build where clause for manager filtering
        let whereClause = {};
        if (!isAdmin) {
            // Manager can only see their assigned employees
            whereClause.approving_manager_id = req.userId;
        }

        const users = await TblStaff.findAll({
            where: whereClause,
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role', 'active', 'approving_manager_id', 'admin', 'gender']
        });

        res.send(users);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving users."
        });
    }
};

exports.getManagersAndAdmins = (req, res) => {
    const { Op } = require("sequelize");
    TblStaff.findAll({
        where: { role: { [Op.in]: [1, 2] }, active: 1 },
        attributes: ['staffid', 'firstname', 'lastname', 'email', 'role']
    })
        .then(users => {
            res.send(users);
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while retrieving managers and admins."
            });
        });
};

exports.getPendingApprovals = async (req, res) => {
    const { Op } = require("sequelize");

    // Get current user from token
    const currentUserId = req.userId; // Set by authJwt middleware

    console.log('\n=== getPendingApprovals called ===');
    console.log('Current User ID:', currentUserId);

    try {
        // Get the current user to check their role
        const currentUser = await TblStaff.findByPk(currentUserId);
        if (!currentUser) {
            console.log('User not found:', currentUserId);
            return res.status(404).send({
                message: "User not found."
            });
        }

        console.log('Current User:', currentUser.firstname, 'Admin:', currentUser.admin);

        // Check if user is admin (admin field = 1)
        const isAdmin = currentUser.admin === 1;

        // Build where clause: if not admin, filter by manager_id
        let whereClause = {};
        if (!isAdmin) {
            // Not an admin, so only show approvals where manager_id matches current user
            whereClause.manager_id = currentUserId;
            console.log('Filtering by manager_id:', currentUserId);
        } else {
            console.log('Admin user - showing all approvals');
        }
        // If admin, show all approvals (no filter on manager_id)

        // Fetch all approvals
        const approvals = await Approval.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
            raw: true
        });

        console.log('Found approvals:', approvals.length);
        approvals.forEach(a => {
            console.log('  - Approval', a.id, '| Type:', a.attendance_log_id ? 'attendance' : (a.on_duty_log_id ? 'on-duty' : 'UNKNOWN'), '| Manager:', a.manager_id, '| Status:', a.status);
        });

        // For each approval, fetch the related data
        const enrichedApprovals = await Promise.all(
            approvals.map(async (approval) => {
                const enriched = { ...approval };

                // Attendance logs model doesn't exist in current schema
                enriched.attendance_log = null;

                // Fetch on-duty log if exists
                if (approval.on_duty_log_id) {
                    console.log('Fetching on_duty_log:', approval.on_duty_log_id);
                    const onDutyLogRaw = await db.on_duty_logs.findByPk(
                        approval.on_duty_log_id,
                        {
                            include: [
                                {
                                    model: TblStaff,
                                    as: 'user',
                                    attributes: ['firstname', 'lastname', 'email', 'staffid', 'approving_manager_id']
                                }
                            ]
                        }
                    );
                    
                    if (onDutyLogRaw) {
                        enriched.on_duty_log = onDutyLogRaw.toJSON();
                        enriched.on_duty_log.tblstaff = enriched.on_duty_log.user;
                    } else {
                        enriched.on_duty_log = null;
                    }
                    
                    if (!onDutyLogRaw) {
                        console.log('⚠️  on_duty_log not found for ID:', approval.on_duty_log_id);
                    } else {
                        console.log('✅ on_duty_log found:', onDutyLog.client_name);
                    }
                } else {
                    enriched.on_duty_log = null;
                }

                // Fetch manager
                const manager = await TblStaff.findByPk(
                    approval.manager_id,
                    { attributes: ['firstname', 'lastname', 'staffid'] }
                );
                enriched.manager = manager;

                return enriched;
            })
        );

        console.log('Enriched approvals:', enrichedApprovals.length);
        console.log('=== getPendingApprovals complete ===\n');
        res.send(enrichedApprovals);
    } catch (err) {
        console.error('❌ Error in getPendingApprovals:', err.message);
        console.error(err.stack);
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving approvals."
        });
    }
};

exports.approveAttendance = (req, res) => {
    const id = req.params.id;

    Approval.update(req.body, {
        where: { id: id }
    })
        .then(num => {
            if (num == 1) {
                res.send({
                    message: "Approval status was updated successfully."
                });
            } else {
                res.send({
                    message: `Cannot update Approval with id=${id}. Maybe Approval was not found or req.body is empty!`
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error updating Approval with id=" + id
            });
        });
};

exports.getAttendanceReports = async (req, res) => {
    try {
        const { Op } = require("sequelize");
        const LeaveRequest = db.leave_requests;
        const OnDutyLog = db.on_duty_logs;
        const Staff = db.user;

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
            console.log(`Manager ${req.userId} - filtering reports by reportees:`, reporteeIds);

            if (reporteeIds.length === 0) {
                // Manager has no reportees, return empty
                return res.send([]);
            }
        }

        // Build where clause for leaves
        let leaveWhere = {};
        if (!isAdmin) {
            leaveWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Get leave requests with approver info
        const leaveRequests = await LeaveRequest.findAll({
            where: leaveWhere,
            include: [
                { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                {
                    model: db.user,
                    as: 'approver',
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Transform leave requests for the frontend
        const transformedLeaves = leaveRequests.map(leave => ({
            id: leave.id,
            staff_id: leave.staff_id,
            check_in_time: null,
            check_out_time: null,
            date: leave.start_date,
            start_date: leave.start_date,
            end_date: leave.end_date,
            leave_type: leave.leave_type,
            reason: leave.reason,
            status: leave.status,
            rejection_reason: leave.rejection_reason,
            on_duty: false,
            tblstaff: leave.user,
            approver: leave.approver || null
        }));

        // Build where clause for on-duty logs
        let onDutyWhere = {};
        if (!isAdmin) {
            onDutyWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Get on-duty logs with approver info
        const onDutyLogs = await OnDutyLog.findAll({
            where: onDutyWhere,
            include: [
                { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                {
                    model: db.user,
                    as: 'approver',
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    required: false
                }
            ],
            order: [['start_time', 'DESC']]
        });

        // Transform on-duty logs to match attendance log structure for the frontend
        const transformedOnDutyLogs = onDutyLogs.map(log => ({
            id: log.id,
            staff_id: log.staff_id,
            check_in_time: log.start_time,
            check_out_time: log.end_time,
            date: new Date(log.start_time).toISOString().split('T')[0],
            location: log.location,
            client_name: log.client_name,
            purpose: log.purpose,
            status: log.status,
            rejection_reason: log.rejection_reason,
            on_duty: true,
            tblstaff: log.user,
            approver: log.approver || null
        }));

        // Combine both arrays
        const combinedReports = [...transformedLeaves, ...transformedOnDutyLogs];

        // Sort by date descending
        combinedReports.sort((a, b) => {
            const dateA = new Date(a.date || a.check_in_time);
            const dateB = new Date(b.date || b.check_in_time);
            return dateB - dateA;
        });

        res.send(combinedReports);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving reports."
        });
    }
};

exports.getDashboardStats = async (req, res) => {
    const { Op } = require("sequelize");
    const OnDutyLog = db.on_duty_logs;
    const LeaveRequest = db.leave_requests;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateOnly = today.toISOString().split('T')[0];

    // Calculate yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateOnly = yesterday.toISOString().split('T')[0];

    try {
        // Get current user's role to determine filtering
        const currentUser = await TblStaff.findByPk(req.userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        // If manager, get their reportees
        let reporteeIds = [];
        if (!isAdmin) {
            const reportees = await TblStaff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        // Build staff filter for manager
        let staffFilter = {};
        let staffFilterWithReportees = {};
        if (!isAdmin) {
            staffFilter = { staff_id: { [Op.in]: reporteeIds } };
            staffFilterWithReportees = { approving_manager_id: req.userId };
        }

        const results = await Promise.all([
            // Total users (for admin: all users, for manager: their reportees)
            isAdmin ? TblStaff.count() : TblStaff.count({ where: { approving_manager_id: req.userId } }),
            // New users added today
            TblStaff.count({
                where: {
                    datecreated: { [Op.gte]: today },
                    ...(isAdmin ? {} : { approving_manager_id: req.userId })
                }
            }),
            // New users added yesterday
            TblStaff.count({
                where: {
                    datecreated: {
                        [Op.gte]: yesterday,
                        [Op.lt]: today
                    },
                    ...(isAdmin ? {} : { approving_manager_id: req.userId })
                }
            }),
            // Present today (distinct staff with check_in on on-duty logs)
            OnDutyLog.findAll({
                attributes: [
                    [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('staff_id'))), 'distinct_staff']
                ],
                where: {
                    start_time: { [Op.gte]: today },
                    end_time: { [Op.ne]: null },
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                },
                raw: true
            }).then(result => result[0]?.distinct_staff || 0),
            // Present yesterday (distinct staff with check_in on on-duty logs)
            OnDutyLog.findAll({
                attributes: [
                    [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('staff_id'))), 'distinct_staff']
                ],
                where: {
                    start_time: { [Op.gte]: yesterday, [Op.lt]: today },
                    end_time: { [Op.ne]: null },
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                },
                raw: true
            }).then(result => result[0]?.distinct_staff || 0),
            // On duty count
            OnDutyLog.count({
                where: {
                    end_time: null,
                    start_time: { [Op.gte]: today },
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Pending leave approvals
            LeaveRequest.count({
                where: {
                    status: 'Pending',
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Approved leaves
            LeaveRequest.count({
                where: {
                    status: 'Approved',
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Rejected leaves
            LeaveRequest.count({
                where: {
                    status: 'Rejected',
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Pending on-duty approvals (only those that have ended)
            OnDutyLog.count({
                where: {
                    status: 'Pending',
                    end_time: { [Op.ne]: null },
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Approved on-duty logs
            OnDutyLog.count({
                where: {
                    status: 'Approved',
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Rejected on-duty logs
            OnDutyLog.count({
                where: {
                    status: 'Rejected',
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Active on-duty logs (end_time is null)
            OnDutyLog.count({
                where: {
                    end_time: null,
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            })
        ]);

        const [totalUsers, newUsersToday, newUsersYesterday, presentToday, presentYesterday, onDuty, pendingLeaves, approvedLeaves, rejectedLeaves, pendingOnDuty, approvedOnDuty, rejectedOnDuty, activeOnDuty] = results;

        // Calculate new users trend
        let usersTrend = 0;
        if (newUsersYesterday > 0) {
            usersTrend = Math.round(((newUsersToday - newUsersYesterday) / newUsersYesterday) * 100);
        } else if (newUsersToday > 0) {
            usersTrend = 100; // If yesterday was 0 and today is > 0, it's a 100% increase
        }

        // Calculate attendance trend percentage
        let presentTrend = 0;
        if (presentYesterday > 0) {
            presentTrend = Math.round(((presentToday - presentYesterday) / presentYesterday) * 100);
        } else if (presentToday > 0) {
            presentTrend = 100; // If yesterday was 0 and today is > 0, it's a 100% increase
        }

        console.log('Dashboard Stats:', {
            pendingLeaves,
            approvedLeaves,
            rejectedLeaves,
            pendingOnDuty,
            approvedOnDuty,
            rejectedOnDuty,
            activeOnDuty
        });

        res.send({
            totalUsers,
            usersTrend,
            presentToday,
            presentTrend,
            onDuty,
            pendingLeaves,
            approvedLeaves,
            rejectedLeaves,
            pendingOnDuty,
            approvedOnDuty,
            rejectedOnDuty,
            activeOnDuty
        });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving dashboard stats."
        });
    }
};

exports.getDailyTrendData = async (req, res) => {
    const { Op } = require("sequelize");
    const LeaveRequest = db.leave_requests;
    const OnDutyLog = db.on_duty_logs;
    const Staff = db.user;
    const days = parseInt(req.query.days) || 7;

    try {
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

        const trendData = [];
        const today = new Date();

        // Generate dates for the selected duration
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            const dateStr = `${day}/${month}/${year}`;

            // Count approved leaves on this day
            const approvedLeavesCount = await LeaveRequest.count({
                where: {
                    status: 'Approved',
                    updatedAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            });

            // Count approved on-duty logs on this day
            const approvedOnDutyCount = await OnDutyLog.count({
                where: {
                    status: 'Approved',
                    updatedAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    ...(isAdmin ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            });

            trendData.push({
                day: dateStr,
                leaves: approvedLeavesCount,
                onDuty: approvedOnDutyCount,
                total: approvedLeavesCount + approvedOnDutyCount
            });
        }

        console.log(`Daily trend data for ${days} days:`, trendData);
        res.send(trendData);
    } catch (error) {
        console.error('Error fetching daily trend data:', error);
        res.status(500).send({
            message: error.message || "Error occurred while fetching daily trend data."
        });
    }
};

exports.getCalendarEvents = async (req, res) => {
    const { Op } = require("sequelize");
    const LeaveRequest = db.leave_requests;
    const OnDutyLog = db.on_duty_logs;
    const Staff = db.user;

    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const userId = req.userId; // From JWT token middleware

        // Get the first and last day of the month
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        // Get current user's role
        const currentUser = await Staff.findByPk(userId);
        console.log(`Current user lookup - userId: ${userId}, found: ${!!currentUser}, admin: ${currentUser?.admin}`);
        const isAdmin = currentUser && currentUser.admin === 1;

        console.log(`User ${userId} fetching calendar - isAdmin: ${isAdmin}`);

        // Determine which staff to fetch events for
        let reporteeIds = [];
        if (!isAdmin) {
            // If manager, get only reportees (staff where approving_manager_id = userId)
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: {
                    approving_manager_id: userId
                },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);

            console.log(`Manager ${userId} query - reportees found:`, reporteeIds);

            if (reporteeIds.length === 0) {
                // Manager has no reportees, return empty array
                console.log(`Manager ${userId} has no reportees - returning empty events`);
                return res.send([]);
            }
        } else {
            console.log(`Admin ${userId} - showing all staff events`);
        }

        // Build the base where condition for leave requests
        const leaveWhere = {
            status: { [Op.in]: ['Approved', 'Rejected', 'Pending'] },
            [Op.or]: [
                {
                    start_date: {
                        [Op.between]: [firstDay, lastDay]
                    }
                },
                {
                    end_date: {
                        [Op.between]: [firstDay, lastDay]
                    }
                },
                {
                    [Op.and]: [
                        {
                            start_date: {
                                [Op.lte]: firstDay
                            }
                        },
                        {
                            end_date: {
                                [Op.gte]: lastDay
                            }
                        }
                    ]
                }
            ]
        };

        // If manager, filter by reportee IDs
        if (!isAdmin) {
            leaveWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Fetch approved leave requests for the month
        const leaveRequests = await LeaveRequest.findAll({
            where: leaveWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['staffid', 'firstname', 'lastname'],
                required: true
            }],
            raw: false
        });

        console.log(`Found ${leaveRequests.length} leave requests with where:`, JSON.stringify(leaveWhere));

        // Build the base where condition for on-duty logs
        // Include all statuses to show complete history
        const onDutyWhere = {
            status: { [Op.in]: ['Approved', 'Rejected', 'Pending'] },
            start_time: {
                [Op.between]: [firstDay, lastDay]
            }
        };

        // If manager, filter by reportee IDs
        if (!isAdmin) {
            onDutyWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Fetch approved and pending on-duty logs for the month
        const onDutyLogs = await OnDutyLog.findAll({
            where: onDutyWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['staffid', 'firstname', 'lastname'],
                required: true
            }],
            raw: false
        });

        console.log(`Found ${onDutyLogs.length} on-duty logs with where:`, JSON.stringify(onDutyWhere));

        // Process leave requests and create events for each day
        const events = [];

        leaveRequests.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);

            // For each day in the leave period, create an event
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const staffName = `${leave.user.firstname} ${leave.user.lastname}`;

                events.push({
                    date: dateStr,
                    type: 'leave',
                    staff_name: staffName,
                    title: leave.leave_type,
                    reason: leave.reason,
                    status: leave.status,
                    start_date: leave.start_date,
                    end_date: leave.end_date,
                    rejection_reason: leave.rejection_reason
                });
            }
        });

        // Process on-duty logs
        onDutyLogs.forEach(onDuty => {
            const dateStr = new Date(onDuty.start_time).toISOString().split('T')[0];
            const staffName = `${onDuty.user.firstname} ${onDuty.user.lastname}`;

            // Use purpose field if available, otherwise extract from reason
            let purpose = onDuty.purpose || '';
            let location = onDuty.location || '';

            // If no purpose but reason exists, try to extract from reason format "purpose (location)"
            if (!purpose && onDuty.reason) {
                const reasonMatch = onDuty.reason.match(/^(.+?)\s*\((.+?)\)$/);
                purpose = reasonMatch ? reasonMatch[1] : onDuty.reason;
                location = reasonMatch ? reasonMatch[2] : location;
            }

            events.push({
                date: dateStr,
                type: 'on_duty',
                staff_name: staffName,
                title: purpose || 'On-Duty',
                reason: location,
                client_name: onDuty.client_name || null,
                start_time: onDuty.start_time,
                end_time: onDuty.end_time,
                status: onDuty.status || 'Approved',
                rejection_reason: onDuty.rejection_reason
            });
        });

        console.log(`Calendar events for ${year}-${month}:`, events);
        res.send(events);
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).send({
            message: error.message || "Error occurred while fetching calendar events."
        });
    }
};

exports.debugCalendarData = async (req, res) => {
    const { Op } = require("sequelize");
    const Staff = db.user;
    const LeaveRequest = db.leave_requests;
    const OnDutyLog = db.on_duty_logs;

    try {
        const userId = req.userId;
        const currentUser = await Staff.findByPk(userId);
        const isAdmin = currentUser && currentUser.admin === 1;

        console.log(`\n=== DEBUG CALENDAR DATA ===`);
        console.log(`User ID: ${userId}`);
        console.log(`User Name: ${currentUser?.firstname} ${currentUser?.lastname}`);
        console.log(`Is Admin: ${isAdmin}`);

        const debugInfo = {
            userId,
            userName: `${currentUser?.firstname} ${currentUser?.lastname}`,
            isAdmin,
            reportees: [],
            leaveCounts: {},
            onDutyCounts: {}
        };

        if (!isAdmin) {
            // Get reportees
            const reportees = await Staff.findAll({
                attributes: ['staffid', 'firstname', 'lastname', 'reporting_to', 'approving_manager_id'],
                where: {
                    approving_manager_id: userId
                },
                raw: true
            });

            console.log(`Reportees for manager ${userId}:`, reportees);
            debugInfo.reportees = reportees;

            if (reportees.length > 0) {
                const reporteeIds = reportees.map(r => r.staffid);

                // Check leave requests
                const leaveCount = await LeaveRequest.count({
                    where: {
                        status: 'Approved',
                        staff_id: { [Op.in]: reporteeIds }
                    }
                });

                // Check on-duty logs
                const onDutyCount = await OnDutyLog.count({
                    where: {
                        status: 'Approved',
                        staff_id: { [Op.in]: reporteeIds }
                    }
                });

                console.log(`Leave requests for reportees: ${leaveCount}`);
                console.log(`On-duty logs for reportees: ${onDutyCount}`);

                debugInfo.leaveCounts.reportees = leaveCount;
                debugInfo.onDutyCounts.reportees = onDutyCount;
            } else {
                // Check all staff and their reporting relationships
                console.log(`No reportees found for manager ${userId}. Checking approving_manager_id values...`);
                const allStaff = await Staff.findAll({
                    attributes: ['staffid', 'firstname', 'lastname', 'reporting_to', 'approving_manager_id'],
                    raw: true
                });
                console.log(`All staff with approving_manager_id:`, allStaff);
                debugInfo.allStaffReportingTo = allStaff;
            }
        } else {
            // Get total counts for admin
            const totalLeave = await LeaveRequest.count({
                where: {
                    status: 'Approved'
                }
            });

            const totalOnDuty = await OnDutyLog.count({
                where: {
                    status: 'Approved'
                }
            });

            console.log(`Total leave requests: ${totalLeave}`);
            console.log(`Total on-duty logs: ${totalOnDuty}`);

            debugInfo.leaveCounts.total = totalLeave;
            debugInfo.onDutyCounts.total = totalOnDuty;
        }

        // For all users (admin or not), show all staff with reporting relationships
        const allStaffWithReporting = await Staff.findAll({
            attributes: ['staffid', 'firstname', 'lastname', 'reporting_to', 'approving_manager_id', 'admin'],
            raw: true
        });
        console.log(`All staff with reporting info:`, allStaffWithReporting);
        debugInfo.allStaffReporting = allStaffWithReporting;

        console.log(`=== END DEBUG ===\n`);

        res.send(debugInfo);
    } catch (error) {
        console.error('Error in debug calendar:', error);
        res.status(500).send({
            message: error.message || "Error in debug calendar data."
        });
    }
};


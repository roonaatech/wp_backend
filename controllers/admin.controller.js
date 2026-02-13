const db = require("../models");
const bcrypt = require("bcryptjs");
const TblStaff = db.user;
const OnDutyLog = db.on_duty_logs;
const TimeOffRequest = db.time_off_requests;
const Approval = db.approvals;
const { logActivity, getClientIp, getUserAgent } = require("../utils/activity.logger");
const Op = db.Sequelize.Op;

exports.getIncompleteProfiles = async (req, res) => {
    try {
        const incompleteUsers = await TblStaff.findAll({
            where: {
                [Op.or]: [
                    { role: 0 },
                    { role: null },
                    { gender: null },
                    { gender: '' }
                ],
                active: 1 // Only check active users
            },
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role', 'gender']
        });

        res.status(200).send(incompleteUsers);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving incomplete profiles."
        });
    }
};

exports.createUser = async (req, res) => {
    const { firstname, lastname, email, password, role, approving_manager_id, gender } = req.body;

    // Validate input
    if (!firstname || !lastname || !email || !password || !role || !gender) {
        return res.status(400).send({
            message: "All fields (firstname, lastname, email, password, role, gender) are required."
        });
    }

    const roleInt = parseInt(role);
    if (isNaN(roleInt) || roleInt === 0) {
        return res.status(400).send({ message: "Invalid Role value." });
    }

    try {
        // Get current user's role to check hierarchy
        const Role = db.roles;
        const currentUser = await TblStaff.findByPk(req.userId);
        const currentUserRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Get the role being assigned to check hierarchy
        const newRole = await Role.findByPk(roleInt);
        if (!newRole) {
            return res.status(400).send({
                message: "Invalid role specified."
            });
        }

        // Hierarchy check: users can only create users with LOWER authority (higher hierarchy_level)
        // Exception: Super Admin (level 0) can create any role
        if (currentUserRole) {
            const currentLevel = currentUserRole.hierarchy_level;
            const newRoleLevel = newRole.hierarchy_level;

            if (currentLevel > 0 && newRoleLevel <= currentLevel) {
                return res.status(403).send({
                    message: `You don't have permission to create users with ${newRole.display_name} role.`
                });
            }
        }

        // Validate approving manager requirement based on role hierarchy
        // Roles that need an approver (not super_admin level) should have approving_manager_id
        if (newRole.hierarchy_level > 0 && !approving_manager_id) {
            // Check if the role actually needs an approver
            const potentialApprovers = await Role.findAll({
                where: {
                    hierarchy_level: { [Op.lte]: newRole.hierarchy_level },
                    [Op.or]: [
                        { can_approve_leave: { [Op.ne]: 'none' } },
                        { can_approve_onduty: { [Op.ne]: 'none' } }
                    ],
                    active: true
                }
            });

            if (potentialApprovers.length > 0) {
                return res.status(400).send({
                    message: `${newRole.display_name} role requires an approving manager.`
                });
            }
        }

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
            role: roleInt,
            approving_manager_id: approving_manager_id ? parseInt(approving_manager_id) : null,
            gender: gender,
            active: 1
        });

        // Assign default leave types to user
        const LeaveType = db.leave_types;
        const UserLeaveType = db.user_leave_types;
        const defaultLeaveTypes = await LeaveType.findAll({ where: { status: true } });
        const userLeaveTypes = defaultLeaveTypes.map(lt => ({
            user_id: newUser.staffid,
            leave_type_id: lt.id,
            days_allowed: lt.days_allowed,
            days_used: 0
        }));
        await UserLeaveType.bulkCreate(userLeaveTypes);

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
                userid: newUser.userid,
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

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { firstname, lastname, email, password, role, approving_manager_id, gender } = req.body;

    // Validate input
    if (!firstname || !lastname || !email || !role) {
        return res.status(400).send({
            message: "Firstname, lastname, email, and role are required."
        });
    }

    // Prepare role and validate
    const roleInt = parseInt(role);
    if (isNaN(roleInt) || roleInt === 0) {
        return res.status(400).send({
            message: "Invalid Role value."
        });
    }

    // Validate role and manager_id requirements
    if (roleInt === 2 && !approving_manager_id) {
        return res.status(400).send({
            message: "Manager role requires an approving admin manager."
        });
    }

    try {
        // Get current user's role to check hierarchy
        const currentUser = await TblStaff.findByPk(req.userId);
        const Role = db.roles;
        const currentUserRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Get target user and their role
        const targetUser = await TblStaff.findByPk(id);
        if (!targetUser) {
            return res.status(404).send({
                message: "User not found."
            });
        }

        const targetUserRole = targetUser.role ? await Role.findByPk(targetUser.role) : null;

        // Check hierarchy: users can only edit users with HIGHER hierarchy level (lower authority)
        // Exception: Super Admin (level 0) can edit anyone
        // Exception: If current user is the approving manager of target user (same role reporting)
        if (currentUserRole && targetUserRole) {
            const currentLevel = currentUserRole.hierarchy_level;
            const targetLevel = targetUserRole.hierarchy_level;
            const isApprovingManager = targetUser.approving_manager_id === req.userId;

            // If current user is not super_admin (level 0), check hierarchy
            // Allow if same level AND current user is the approving manager
            if (currentLevel > 0 && targetLevel <= currentLevel) {
                // Exception: allow if same level and is approving manager
                if (!(targetLevel === currentLevel && isApprovingManager)) {
                    return res.status(403).send({
                        message: `You don't have permission to edit users with ${targetUserRole.display_name} role.`
                    });
                }
            }
        }

        // Check role escalation: prevent assigning a role with equal or higher authority than current user
        // Exception: Super Admin (level 0) can assign any role
        const newRole = await Role.findByPk(roleInt);
        if (!newRole) {
            return res.status(400).send({
                message: "Invalid role specified."
            });
        }

        if (currentUserRole) {
            const currentLevel = currentUserRole.hierarchy_level;
            const newRoleLevel = newRole.hierarchy_level;

            if (currentLevel > 0 && newRoleLevel <= currentLevel) {
                return res.status(403).send({
                    message: `You don't have permission to assign ${newRole.display_name} role.`
                });
            }
        }

        // Check if new email is already used by another user
        if (email !== targetUser.email) {
            const existingUser = await TblStaff.findOne({ where: { email: email } });
            if (existingUser) {
                return res.status(409).send({
                    message: "Email already exists."
                });
            }
        }

        // Build update object
        const updateData = {
            firstname: firstname,
            lastname: lastname,
            email: email,
            role: roleInt,
            approving_manager_id: approving_manager_id ? parseInt(approving_manager_id) : null,
            gender: gender,
            active: req.body.active !== undefined ? req.body.active : targetUser.active
        };

        // Only update password if provided
        if (password) {
            updateData.password = bcrypt.hashSync(password, 8);
        }

        // Update user
        const updatedUser = await targetUser.update(updateData);

        // Log activity
        await logActivity({
            admin_id: req.userId,
            action: 'UPDATE',
            entity: 'User',
            entity_id: updatedUser.staffid,
            affected_user_id: updatedUser.staffid,
            description: `Updated user account for ${updatedUser.firstname} ${updatedUser.lastname}`,
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req)
        });

        res.send({
            message: "User updated successfully.",
            user: {
                staffid: updatedUser.staffid,
                firstname: updatedUser.firstname,
                lastname: updatedUser.lastname,
                email: updatedUser.email,
                role: updatedUser.role,
                userid: updatedUser.userid,
                approving_manager_id: updatedUser.approving_manager_id,
                gender: updatedUser.gender,
                active: updatedUser.active
            }
        });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).send({
            message: err.message || "Error updating user."
        });
    }
};

// Reset user password (Admin only)
exports.resetUserPassword = async (req, res) => {
    try {
        const userId = req.params.id;
        const { newPassword } = req.body;

        // Verify admin permission using role's can_manage_users flag
        const currentUser = await TblStaff.findByPk(req.userId);
        if (!currentUser) {
            return res.status(403).send({
                message: "Access denied. User not found."
            });
        }

        // Check if user has admin permission (can_manage_users) - role-based only
        const Role = db.roles;
        const userRole = await Role.findByPk(currentUser.role);
        const hasAdminPermission = userRole && (userRole.can_manage_users === 'all' || userRole.can_manage_users === 'subordinates');

        if (!hasAdminPermission) {
            return res.status(403).send({
                message: "Access denied. Only users with management permissions can reset passwords."
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

        // Check hierarchy: users can only reset password for users with HIGHER hierarchy level (lower authority)
        // Exception: If current user is the approving manager of target user (same role reporting)
        const targetUserRole = user.role ? await Role.findByPk(user.role) : null;
        if (userRole && targetUserRole) {
            const currentLevel = userRole.hierarchy_level;
            const targetLevel = targetUserRole.hierarchy_level;
            const isApprovingManager = user.approving_manager_id === req.userId;

            // If current user is not super_admin (level 0), check hierarchy
            // Allow if same level AND current user is the approving manager
            if (currentLevel > 0 && targetLevel <= currentLevel) {
                // Exception: allow if same level and is approving manager
                if (!(targetLevel === currentLevel && isApprovingManager)) {
                    return res.status(403).send({
                        message: `You don't have permission to reset password for users with ${targetUserRole.display_name} role.`
                    });
                }
            }
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
        const Role = db.roles;
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Check both manage and view permissions for "all" access
        const canManageAllUsers = userRole && userRole.can_manage_users === 'all';
        const canViewAllUsers = userRole && userRole.can_view_users === 'all';
        const canViewAllReports = userRole && userRole.can_view_reports === 'all';
        const hasAllUsersAccess = canManageAllUsers || canViewAllUsers || canViewAllReports;

        // Check subordinates-level access
        const canManageSubordinates = userRole && userRole.can_manage_users === 'subordinates';
        const canViewSubordinates = userRole && userRole.can_view_users === 'subordinates';
        const hasSubordinatesAccess = canManageSubordinates || canViewSubordinates;

        // Pagination parameters
        const page = req.query.page ? parseInt(req.query.page) : 1;
        let limit = 10;
        let offset = 0;

        if (req.query.limit === 'all') {
            limit = null;
        } else if (req.query.limit) {
            limit = parseInt(req.query.limit);
        }

        if (limit) {
            offset = (page - 1) * limit;
        }

        // Search & Filter parameters
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const letter = req.query.letter || '';
        const role = req.query.role || ''; // Comma-separated role ids

        // Build where clause using AND conditions
        const andConditions = [];

        // User access constraint based on permissions
        if (!hasAllUsersAccess) {
            if (hasSubordinatesAccess) {
                // User can only see their assigned employees (subordinates)
                andConditions.push({ approving_manager_id: req.userId });
            } else {
                // No access - return empty (should not happen if middleware works correctly)
                return res.json({ users: [], total: 0, page: 1, totalPages: 0 });
            }
        }

        // Search constraint
        if (search) {
            andConditions.push({
                [Op.or]: [
                    { firstname: { [Op.like]: `%${search}%` } },
                    { lastname: { [Op.like]: `%${search}%` } },
                    { email: { [Op.like]: `%${search}%` } }
                ]
            });
        }

        // Letter constraint (filter by first letter of firstname)
        if (letter) {
            andConditions.push({
                firstname: { [Op.like]: `${letter}%` }
            });
        }

        // Role constraint
        if (role) {
            const roleIds = role.split(',').map(r => parseInt(r.trim())).filter(r => !isNaN(r));
            if (roleIds.length > 0) {
                andConditions.push({
                    role: { [Op.in]: roleIds }
                });
            }
        }

        // Status constraint
        if (status) {
            const statuses = status.split(',').map(s => s.trim());
            const statusConditions = [];

            statuses.forEach(s => {
                if (s === 'active') {
                    statusConditions.push({ active: 1 });
                } else if (s === 'inactive') {
                    statusConditions.push({ active: 0 });
                } else if (s === 'incomplete') {
                    // Incomplete profiles: active users with missing data
                    statusConditions.push({
                        [Op.and]: [
                            { active: 1 },
                            {
                                [Op.or]: [
                                    { role: 0 },
                                    { role: null },
                                    { gender: null },
                                    { gender: '' }
                                ]
                            }
                        ]
                    });
                }
            });

            if (statusConditions.length > 0) {
                andConditions.push({
                    [Op.or]: statusConditions
                });
            }
        }

        const whereClause = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

        const queryOptions = {
            where: whereClause,
            attributes: ['staffid', 'userid', 'firstname', 'lastname', 'email', 'role', 'active', 'approving_manager_id', 'admin', 'gender'],
            order: [['firstname', 'ASC'], ['lastname', 'ASC']]
        };

        if (limit) {
            queryOptions.limit = limit;
            queryOptions.offset = offset;
        }

        const { count, rows } = await TblStaff.findAndCountAll(queryOptions);

        res.send({
            totalItems: count,
            users: rows,
            totalPages: limit ? Math.ceil(count / limit) : 1,
            currentPage: page
        });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving users."
        });
    }
};

exports.getManagersAndAdmins = async (req, res) => {
    const { Op } = require("sequelize");
    const Role = db.roles;

    try {
        // Get all roles that have any approval permission (can_approve_leave or can_approve_onduty not 'none')
        const approverRoles = await Role.findAll({
            where: {
                [Op.or]: [
                    { can_approve_leave: { [Op.ne]: 'none' } },
                    { can_approve_onduty: { [Op.ne]: 'none' } }
                ]
            },
            attributes: ['id']
        });

        const approverRoleIds = approverRoles.map(r => r.id);

        const users = await TblStaff.findAll({
            where: {
                role: { [Op.in]: approverRoleIds },
                active: 1
            },
            attributes: ['staffid', 'userid', 'firstname', 'lastname', 'email', 'role', 'approving_manager_id'],
            order: [['firstname', 'ASC'], ['lastname', 'ASC']]
        });

        res.send(users);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving managers and admins."
        });
    }
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

        console.log('Current User:', currentUser.firstname, 'Role:', currentUser.role);

        // Check if user can approve all (based on role permissions)
        const Role = db.roles;
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        const canApproveAllLeave = userRole && userRole.can_approve_leave === 'all';
        const canApproveAllOnDuty = userRole && userRole.can_approve_onduty === 'all';

        // Get reportees if user doesn't have 'all' permission for either type
        let reporteeIds = [];
        if (!canApproveAllLeave || !canApproveAllOnDuty) {
            const reportees = await TblStaff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: currentUserId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
            console.log('Filtering by manager_id:', currentUserId, 'reportees:', reporteeIds);
        }

        // Fetch all approvals (we'll filter by type after enrichment)
        const approvals = await Approval.findAll({
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

        // Filter approvals based on type and permission
        const filteredApprovals = enrichedApprovals.filter(approval => {
            // For leave requests (attendance_log_id exists)
            if (approval.attendance_log_id) {
                // Check if user has permission to approve leave
                if (canApproveAllLeave) {
                    return true; // Can see all leave requests
                } else if (userRole && userRole.can_approve_leave === 'subordinates') {
                    // Can only see leave requests from reportees
                    return approval.manager_id === currentUserId;
                }
                return false; // No leave approval permission
            }

            // For on-duty requests (on_duty_log_id exists)
            if (approval.on_duty_log_id) {
                // Check if user has permission to approve on-duty
                if (canApproveAllOnDuty) {
                    return true; // Can see all on-duty requests
                } else if (userRole && userRole.can_approve_onduty === 'subordinates') {
                    // Can only see on-duty requests from reportees
                    return approval.manager_id === currentUserId;
                }
                return false; // No on-duty approval permission
            }

            return false; // Unknown approval type
        });

        console.log('Filtered approvals:', filteredApprovals.length);
        console.log('=== getPendingApprovals complete ===\n');
        res.send(filteredApprovals);
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
    console.log('API Hit: getAttendanceReports', req.query);
    try {
        const { Op } = require("sequelize");
        const LeaveRequest = db.leave_requests;
        const OnDutyLog = db.on_duty_logs;
        const TimeOffRequest = db.time_off_requests;
        const Staff = db.user;
        const Role = db.roles;

        // --- 1. Permissions & User Scoping ---
        const currentUser = await Staff.findByPk(req.userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Determine what the user can see
        const canViewAllReports = userRole && userRole.can_view_reports === 'all';
        const canViewSubordinateReports = userRole && (userRole.can_view_reports === 'subordinates' || userRole.can_view_reports === 'all');

        let reporteeIds = [];
        // If strict subordinate viewer, fetch reportees
        if (!canViewAllReports && canViewSubordinateReports) {
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);

            // If explicit user filter is applied, ensure it's a reportee
            if (req.query.userId && !reporteeIds.includes(parseInt(req.query.userId))) {
                // Trying to access non-reportee
                return res.send({
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: 1,
                    reports: []
                });
            }
        } else if (!canViewAllReports && !canViewSubordinateReports) {
            // Can't view any reports? Or maybe just own? 
            // Assuming "not all" and "not subordinates" means "none" or "own" logic if we had it.
            // For safety, return empty if no read permission
            if (!userRole.can_view_reports) return res.send({ totalItems: 0, reports: [] });
        }

        // --- 2. Filters (Query Params) ---
        // type: 'leave', 'onduty', 'both' (default)
        // userId: int
        // dateFilter: 'all', '7days', '30days', '90days' (handled via dates) or legacy startDate/endDate
        // status: 'approved', 'pending', 'rejected', 'active', 'completed', 'all'

        const { page = 1, limit = 10, type = 'both', userId, dateFilter, status } = req.query;
        const limitVal = parseInt(limit);
        const offsetVal = (parseInt(page) - 1) * limitVal;

        // Build Date Query
        let dateWhereLeave = {};
        let dateWhereOnDuty = {};
        let dateWhereTimeOff = {};

        if (dateFilter && dateFilter !== 'all') {
            const today = new Date();
            let startDate = new Date();
            if (dateFilter === '7days') startDate.setDate(today.getDate() - 7);
            if (dateFilter === '30days') startDate.setDate(today.getDate() - 30);
            if (dateFilter === '90days') startDate.setDate(today.getDate() - 90);

            dateWhereLeave.start_date = { [Op.gte]: startDate };
            dateWhereOnDuty.start_time = { [Op.gte]: startDate };
            dateWhereTimeOff.date = { [Op.gte]: startDate };
        }

        // User Query
        let userWhere = {};
        if (userId) {
            userWhere.staff_id = parseInt(userId);
        } else if (!canViewAllReports) {
            userWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Status Query (Complex mapping due to different statuses)
        let statusWhereLeave = {};
        let statusWhereOnDuty = {};
        let statusWhereTimeOff = {};

        if (status && status !== 'all') {
            if (status === 'approved') {
                statusWhereLeave.status = 'Approved';
                statusWhereOnDuty.status = 'Approved';
                statusWhereTimeOff.status = 'Approved';
            } else if (status === 'pending') {
                // Pending = items pending approval that are completed/ready for review
                statusWhereLeave.status = 'Pending';
                // For on-duty, pending means completed session awaiting approval
                statusWhereOnDuty.status = 'Pending';
                statusWhereOnDuty.end_time = { [Op.ne]: null };
                statusWhereTimeOff.status = 'Pending';
            } else if (status === 'rejected') {
                statusWhereLeave.status = 'Rejected';
                statusWhereOnDuty.status = 'Rejected';
                statusWhereTimeOff.status = 'Rejected';
            } else if (status === 'active') {
                // Active = on-duty with no end_time (still in progress)
                statusWhereOnDuty.end_time = null;
                // Leaves and time-off don't have "active" state - exclude them for this filter
                statusWhereLeave.id = null;
                statusWhereTimeOff.id = null;
            } else if (status === 'completed') {
                // Completed = on-duty with end_time (session finished, any approval status)
                statusWhereOnDuty.end_time = { [Op.ne]: null };
                // For leaves, "completed" means approved
                statusWhereLeave.status = 'Approved';
                statusWhereTimeOff.status = 'Approved';
            }
        }

        // --- 3. "Lightweight Index" Fetch ---
        // Fetch ID, Date from both tables matching filters

        let allItems = [];

        // Fetch Leaves
        if (type === 'both' || type === 'all' || type === 'leave') {
            const leaves = await LeaveRequest.findAll({
                attributes: ['id', 'start_date', 'createdAt'],
                where: { ...userWhere, ...dateWhereLeave, ...statusWhereLeave },
                raw: true
            });
            allItems = allItems.concat(leaves.map(l => ({
                id: l.id,
                date: new Date(l.start_date || l.createdAt),
                type: 'leave'
            })));
        }

        // Fetch OnDuty
        if (type === 'both' || type === 'all' || type === 'onduty') {
            const onDuties = await OnDutyLog.findAll({
                attributes: ['id', 'start_time', 'createdAt'],
                where: { ...userWhere, ...dateWhereOnDuty, ...statusWhereOnDuty },
                raw: true
            });
            allItems = allItems.concat(onDuties.map(o => ({
                id: o.id,
                date: new Date(o.start_time || o.createdAt),
                type: 'onduty'
            })));
        }

        // Fetch Time-Off
        if (type === 'both' || type === 'all' || type === 'timeoff') {
            const timeOffs = await TimeOffRequest.findAll({
                attributes: ['id', 'date', 'createdAt'],
                where: { ...userWhere, ...dateWhereTimeOff, ...statusWhereTimeOff },
                raw: true
            });
            allItems = allItems.concat(timeOffs.map(t => ({
                id: t.id,
                date: new Date(t.date || t.createdAt),
                type: 'timeoff'
            })));
        }

        // --- 4. Sort & Slice ---
        // Sort descending by date
        allItems.sort((a, b) => b.date - a.date);

        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / limitVal);

        // Slice for current page
        const pagedItems = allItems.slice(offsetVal, offsetVal + limitVal);

        // --- 5. Validating Slice ---
        if (pagedItems.length === 0) {
            return res.send({
                totalItems,
                totalPages,
                currentPage: parseInt(page),
                reports: []
            });
        }

        // --- 6. Fetch Full Details for Sliced Items ---
        const leaveIds = pagedItems.filter(i => i.type === 'leave').map(i => i.id);
        const onDutyIds = pagedItems.filter(i => i.type === 'onduty').map(i => i.id);
        const timeOffIds = pagedItems.filter(i => i.type === 'timeoff').map(i => i.id);

        let finalReports = [];

        if (leaveIds.length > 0) {
            const fullLeaves = await LeaveRequest.findAll({
                where: { id: { [Op.in]: leaveIds } },
                include: [
                    { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                    { model: db.user, as: 'approver', attributes: ['staffid', 'firstname', 'lastname', 'email'], required: false }
                ]
            });

            finalReports = finalReports.concat(fullLeaves.map(leave => ({
                id: leave.id,
                staff_id: leave.staff_id,
                type: 'leave', // Helper for frontend
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
            })));
        }

        if (onDutyIds.length > 0) {
            const fullOnDuties = await OnDutyLog.findAll({
                where: { id: { [Op.in]: onDutyIds } },
                include: [
                    { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                    { model: db.user, as: 'approver', attributes: ['staffid', 'firstname', 'lastname', 'email'], required: false }
                ]
            });

            finalReports = finalReports.concat(fullOnDuties.map(log => ({
                id: log.id,
                staff_id: log.staff_id,
                type: 'onduty',
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
            })));
        }

        if (timeOffIds.length > 0) {
            const fullTimeOffs = await TimeOffRequest.findAll({
                where: { id: { [Op.in]: timeOffIds } },
                include: [
                    { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                    { model: db.user, as: 'approver', attributes: ['staffid', 'firstname', 'lastname', 'email'], required: false }
                ]
            });

            finalReports = finalReports.concat(fullTimeOffs.map(timeOff => ({
                id: timeOff.id,
                staff_id: timeOff.staff_id,
                type: 'timeoff',
                date: timeOff.date,
                start_time: timeOff.start_time,
                end_time: timeOff.end_time,
                reason: timeOff.reason,
                status: timeOff.status,
                rejection_reason: timeOff.rejection_reason,
                on_duty: false,
                tblstaff: timeOff.user,
                approver: timeOff.approver || null
            })));
        }

        // --- 7. Final Sort (to match the sliced order) ---
        finalReports.sort((a, b) => {
            const dateA = new Date(a.date || a.check_in_time || a.start_date);
            const dateB = new Date(b.date || b.check_in_time || a.start_date);
            return dateB - dateA;
        });

        res.send({
            totalItems,
            totalPages,
            currentPage: parseInt(page),
            reports: finalReports
        });

    } catch (err) {
        console.error('Error in getAttendanceReports:', err);
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving reports."
        });
    }
};

exports.getDashboardStats = async (req, res) => {
    const { Op } = require("sequelize");
    const OnDutyLog = db.on_duty_logs;
    const LeaveRequest = db.leave_requests;
    const TimeOffRequest = db.time_off_requests;
    const Role = db.roles;
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

        // Get the user's role permissions
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Check if user can view all reports (based on role permission)
        const canViewAllReports = userRole && userRole.can_view_reports === 'all';
        const canViewSubordinateReports = userRole && (userRole.can_view_reports === 'subordinates' || userRole.can_view_reports === 'all');

        // If user can only view subordinates, get their reportees
        let reporteeIds = [];
        if (!canViewAllReports && canViewSubordinateReports) {
            const reportees = await TblStaff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        // Build staff filter for non-admin users
        let staffFilter = {};
        let staffFilterWithReportees = {};
        if (!canViewAllReports) {
            staffFilter = { staff_id: { [Op.in]: reporteeIds } };
            staffFilterWithReportees = { approving_manager_id: req.userId };
        }

        const results = await Promise.all([
            // Total users (for admin: all users, for manager: their reportees)
            canViewAllReports ? TblStaff.count() : TblStaff.count({ where: { approving_manager_id: req.userId } }),
            // New users added today
            TblStaff.count({
                where: {
                    datecreated: { [Op.gte]: today },
                    ...(canViewAllReports ? {} : { approving_manager_id: req.userId })
                }
            }),
            // New users added yesterday
            TblStaff.count({
                where: {
                    datecreated: {
                        [Op.gte]: yesterday,
                        [Op.lt]: today
                    },
                    ...(canViewAllReports ? {} : { approving_manager_id: req.userId })
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
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
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
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                },
                raw: true
            }).then(result => result[0]?.distinct_staff || 0),
            // On duty count
            OnDutyLog.count({
                where: {
                    end_time: null,
                    start_time: { [Op.gte]: today },
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Pending leave approvals
            LeaveRequest.count({
                where: {
                    status: 'Pending',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Approved leaves
            LeaveRequest.count({
                where: {
                    status: 'Approved',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Rejected leaves
            LeaveRequest.count({
                where: {
                    status: 'Rejected',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Pending on-duty approvals (only those that have ended)
            OnDutyLog.count({
                where: {
                    status: 'Pending',
                    end_time: { [Op.ne]: null },
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Approved on-duty logs
            OnDutyLog.count({
                where: {
                    status: 'Approved',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Rejected on-duty logs
            OnDutyLog.count({
                where: {
                    status: 'Rejected',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Active on-duty logs (end_time is null)
            OnDutyLog.count({
                where: {
                    end_time: null,
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Pending time-off
            TimeOffRequest.count({
                where: {
                    status: 'Pending',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Approved time-off
            TimeOffRequest.count({
                where: {
                    status: 'Approved',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            }),
            // Rejected time-off
            TimeOffRequest.count({
                where: {
                    status: 'Rejected',
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            })
        ]);

        const [totalUsers, newUsersToday, newUsersYesterday, presentToday, presentYesterday, onDuty, pendingLeaves, approvedLeaves, rejectedLeaves, pendingOnDuty, approvedOnDuty, rejectedOnDuty, activeOnDuty, pendingTimeOff, approvedTimeOff, rejectedTimeOff] = results;

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
            activeOnDuty,
            pendingTimeOff,
            approvedTimeOff,
            rejectedTimeOff
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
            activeOnDuty,
            pendingTimeOff,
            approvedTimeOff,
            rejectedTimeOff
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
    const Role = db.roles;

    const days = parseInt(req.query.days) || 7;
    const startDate = req.query.startDate; // Format: YYYY-MM-DD
    const endDate = req.query.endDate; // Format: YYYY-MM-DD

    try {
        // Get current user's role to determine filtering
        const currentUser = await Staff.findByPk(req.userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        const canViewAllReports = userRole && userRole.can_view_reports === 'all';

        // If user can only view subordinates, get their reportees
        let reporteeIds = [];
        if (!canViewAllReports) {
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: { approving_manager_id: req.userId },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
        }

        const trendData = [];
        const today = new Date();
        let dateStart, dateEnd;

        // Determine the date range to use
        if (startDate && endDate) {
            // Use custom date range
            dateStart = new Date(startDate + 'T00:00:00');
            dateEnd = new Date(endDate + 'T23:59:59');
        } else {
            // Use default days range
            dateStart = new Date(today);
            dateStart.setDate(dateStart.getDate() - (days - 1));
            dateStart.setHours(0, 0, 0, 0);
            dateEnd = new Date(today);
            dateEnd.setHours(23, 59, 59, 999);
        }

        // Generate dates for the range
        const currentDate = new Date(dateStart);
        while (currentDate <= dateEnd) {
            const startOfDay = new Date(currentDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(currentDate);
            endOfDay.setHours(23, 59, 59, 999);

            const day = String(currentDate.getDate()).padStart(2, '0');
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const year = String(currentDate.getFullYear()).slice(-2);
            const dateStr = `${day}/${month}/${year}`;

            // Count approved leaves on this day
            const approvedLeavesCount = await LeaveRequest.count({
                where: {
                    status: 'Approved',
                    updatedAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
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
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            });

            // Count approved time-off on this day
            const approvedTimeOffCount = await TimeOffRequest.count({
                where: {
                    status: 'Approved',
                    updatedAt: {
                        [Op.gte]: startOfDay,
                        [Op.lt]: endOfDay
                    },
                    ...(canViewAllReports ? {} : { staff_id: { [Op.in]: reporteeIds } })
                }
            });

            trendData.push({
                day: dateStr,
                leaves: approvedLeavesCount,
                onDuty: approvedOnDutyCount,
                timeOff: approvedTimeOffCount,
                total: approvedLeavesCount + approvedOnDutyCount + approvedTimeOffCount
            });

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
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
        console.log('--- getCalendarEvents Called ---');
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const userId = req.userId; // From JWT token middleware
        console.log(`User ID: ${userId}, Year: ${year}, Month: ${month}`);

        // Get the first and last day of the month
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        // Format dates for DATEONLY comparison (YYYY-MM-DD) to avoid timezone issues
        const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

        console.log(`Fetching calendar events for range: ${firstDayStr} to ${lastDayStr}`);

        // Get current user's role
        const Role = db.roles;
        const currentUser = await Staff.findByPk(userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        const canViewAllSchedules = userRole && userRole.can_manage_schedule === 'all';
        console.log(`Can view all schedules: ${canViewAllSchedules}`);

        // Determine which staff to fetch events for
        let reporteeIds = [];
        if (!canViewAllSchedules) {
            // If user can only view subordinates, get only reportees (staff where approving_manager_id = userId)
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: {
                    approving_manager_id: userId
                },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
            console.log(`User has ${reporteeIds.length} reportees`);

            if (reporteeIds.length === 0) {
                // User has no reportees, return empty array
                console.log('No reportees found, returning empty events');
                return res.send([]);
            }
        } else {
            console.log('User is Admin/Manager with full access');
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

        // If user can only view subordinates, filter by reportee IDs
        if (!canViewAllSchedules) {
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
        console.log(`Found ${leaveRequests.length} leave requests`);

        // Build the base where condition for on-duty logs
        // Include all statuses to show complete history
        const onDutyWhere = {
            status: { [Op.in]: ['Approved', 'Rejected', 'Pending'] },
            start_time: {
                [Op.between]: [firstDay, lastDay]
            }
        };

        // If user can only view subordinates, filter by reportee IDs
        if (!canViewAllSchedules) {
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
        console.log(`Found ${onDutyLogs.length} on-duty logs`);

        // Build the base where condition for time-off requests
        const timeOffWhere = {
            status: { [Op.in]: ['Approved', 'Rejected', 'Pending'] },
            date: {
                [Op.between]: [firstDayStr, lastDayStr]
            }
        };

        // If user can only view subordinates, filter by reportee IDs
        if (!canViewAllSchedules) {
            timeOffWhere.staff_id = { [Op.in]: reporteeIds };
        }

        console.log('Fetching time-off requests with where:', JSON.stringify(timeOffWhere));

        // Fetch approved and pending time-off requests for the month
        const timeOffRequests = await db.time_off_requests.findAll({
            where: timeOffWhere,
            include: [{
                model: Staff,
                as: 'user',
                attributes: ['staffid', 'firstname', 'lastname'],
                required: true
            }],
            raw: false
        });

        console.log(`Found ${timeOffRequests.length} time-off requests`);


        // Transform leave requests into calendar events

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
            if (!purpose && onDuty.reason && typeof onDuty.reason === 'string') {
                const reasonMatch = onDuty.reason.match(/^(.+?)\s*\((.+?)\)$/);
                if (reasonMatch) {
                    purpose = reasonMatch[1];
                    location = reasonMatch[2];
                } else {
                    location = onDuty.reason;
                }
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

        // Process time-off requests
        timeOffRequests.forEach(timeOff => {
            // Hande date conversion carefully. timeOff.date is YYYY-MM-DD string or Date object
            let dateStr;
            if (typeof timeOff.date === 'string') {
                dateStr = timeOff.date;
            } else {
                dateStr = new Date(timeOff.date).toISOString().split('T')[0];
            }

            const staffName = `${timeOff.user.firstname} ${timeOff.user.lastname}`;

            events.push({
                date: dateStr,
                type: 'time_off',
                staff_name: staffName,
                title: 'Time-Off',
                reason: timeOff.reason,
                start_time: timeOff.start_time,
                end_time: timeOff.end_time,
                status: timeOff.status,
                rejection_reason: timeOff.rejection_reason
            });
        });

        console.log(`Sending ${events.length} calendar events (Time-Off: ${events.filter(e => e.type === 'time_off').length})`);
        res.send(events);
    } catch (error) {
        console.error('Error in getCalendarEvents:', error);
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
    const Role = db.roles;

    try {
        const userId = req.userId;
        const currentUser = await Staff.findByPk(userId);
        const userRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        const canViewAllReports = userRole && userRole.can_view_reports === 'all';

        console.log(`\n=== DEBUG CALENDAR DATA ===`);
        console.log(`User ID: ${userId}`);
        console.log(`User Name: ${currentUser?.firstname} ${currentUser?.lastname}`);
        console.log(`Can View All Reports: ${canViewAllReports}`);

        const debugInfo = {
            userId,
            userName: `${currentUser?.firstname} ${currentUser?.lastname}`,
            canViewAllReports,
            reportees: [],
            leaveCounts: {},
            onDutyCounts: {}
        };

        if (!canViewAllReports) {
            // Get reportees
            const reportees = await Staff.findAll({
                attributes: ['staffid', 'firstname', 'lastname', 'reporting_to', 'approving_manager_id'],
                where: {
                    approving_manager_id: userId
                },
                raw: true
            });

            console.log(`Reportees for user ${userId}:`, reportees);
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


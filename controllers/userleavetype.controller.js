const db = require("../models");
const UserLeaveType = db.user_leave_types;
const LeaveType = db.leave_types;

// Get all leave types for a user
exports.getUserLeaveTypes = async (req, res) => {
    try {
        const userId = req.params.userId;
        // Get all leave types
        const allLeaveTypes = await LeaveType.findAll();
        // Get user's assigned leave types
        const userLeaveTypes = await UserLeaveType.findAll({
            where: { user_id: userId }
        });
        // Map assigned leave types by leave_type_id
        const assignedMap = {};
        userLeaveTypes.forEach(ult => {
            assignedMap[ult.leave_type_id] = ult;
        });
        // Build response: all leave types, with assignment info (no default days)
        const result = allLeaveTypes.map(lt => {
            const assigned = assignedMap[lt.id];
            return {
                leave_type_id: lt.id,
                name: lt.name,
                description: lt.description,
                assigned: !!assigned,
                days_allowed: assigned ? assigned.days_allowed : '',
                days_used: assigned ? assigned.days_used : 0
            };
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update leave types for a user (bulk update)
exports.updateUserLeaveTypes = async (req, res) => {
    try {
        const userId = req.params.userId;
        const updates = req.body.leaveTypes; // [{leave_type_id, days_allowed}]

        // Get current user's role and target user to check permissions
        const TblStaff = db.user;
        const Role = db.roles;
        const currentUser = await TblStaff.findByPk(req.userId);
        const currentUserRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        
        // Get target user and their role
        const targetUser = await TblStaff.findByPk(userId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }
        
        const targetUserRole = targetUser.role ? await Role.findByPk(targetUser.role) : null;
        
        // Check hierarchy: users can only manage leave types for users with HIGHER hierarchy level (lower authority)
        // Exception: Super Admin (level 0) can manage anyone
        // Exception: If current user is the approving manager of target user (same role reporting)
        if (currentUserRole && targetUserRole) {
            const currentLevel = currentUserRole.hierarchy_level;
            const targetLevel = targetUserRole.hierarchy_level;
            const isApprovingManager = targetUser.approving_manager_id === req.userId;
            
            // If current user is not super_admin (level 0), check hierarchy
            if (currentLevel > 0 && targetLevel <= currentLevel) {
                // Exception: allow if same level and is approving manager
                if (!(targetLevel === currentLevel && isApprovingManager)) {
                    return res.status(403).json({
                        message: `You don't have permission to manage leave types for users with ${targetUserRole.display_name} role.`
                    });
                }
            }
        }
        
        // Check subordinate permission: if user has 'subordinates' permission, they can only manage their reportees
        const canManageAllUsers = currentUserRole && currentUserRole.can_manage_users === 'all';
        if (!canManageAllUsers && currentUserRole && currentUserRole.can_manage_users === 'subordinates') {
            // User can only manage subordinates
            if (targetUser.approving_manager_id !== req.userId) {
                return res.status(403).json({
                    message: "You can only manage leave types for your direct subordinates."
                });
            }
        }

        // Get all currently assigned leave types for user
        const currentAssignments = await UserLeaveType.findAll({ where: { user_id: userId } });
        const currentIds = currentAssignments.map(ult => ult.leave_type_id);
        const updateIds = updates.map(u => u.leave_type_id);

        // Remove leave types not in updates
        for (const ult of currentAssignments) {
            if (!updateIds.includes(ult.leave_type_id)) {
                await ult.destroy();
            }
        }

        // Add or update assignments
        for (const update of updates) {
            if (!update.days_allowed || isNaN(update.days_allowed)) {
                return res.status(400).json({ message: `days_allowed required for leave_type_id ${update.leave_type_id}` });
            }
            const [record, created] = await UserLeaveType.findOrCreate({
                where: { user_id: userId, leave_type_id: update.leave_type_id },
                defaults: {
                    days_allowed: update.days_allowed,
                    days_used: 0
                }
            });
            if (!created) {
                await record.update({ days_allowed: update.days_allowed });
            }
        }
        res.json({ message: "Leave types updated successfully." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

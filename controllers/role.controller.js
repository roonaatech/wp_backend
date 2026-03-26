const db = require("../models");
const Role = db.roles;
const User = db.user;
const { Op } = require("sequelize");

// Get all roles
exports.findAll = async (req, res) => {
    try {
        // Fetch the current user and their role to determine permission level
        const currentUser = await User.findByPk(req.userId);
        const callerRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;
        const isRoleManager = callerRole && callerRole.can_manage_roles === true;

        // If user has can_manage_roles permission, return all fields
        // Otherwise, return only safe fields needed for display name lookups
        const roles = await Role.findAll({
            order: [['hierarchy_level', 'ASC'], ['id', 'ASC']]
        });
        res.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            message: "Error fetching roles",
            error: error.message
        });
    }
};

// Get single role by ID
exports.findOne = async (req, res) => {
    try {
        const id = req.params.id;
        const role = await Role.findByPk(id);

        if (!role) {
            return res.status(404).json({ message: "Role not found" });
        }

        res.json(role);
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({
            message: "Error fetching role",
            error: error.message
        });
    }
};

// Create new role
exports.create = async (req, res) => {
    try {
        const {
            name,
            display_name,
            description,
            hierarchy_level,
            can_approve_leave,
            can_approve_onduty,
            can_approve_timeoff,
            can_manage_users,
            can_view_users,
            can_manage_leave_types,
            can_view_reports,
            can_manage_active_onduty,
            can_manage_schedule,
            can_view_activities,
            can_access_webapp,
            can_manage_roles,
            can_manage_email_settings,
            can_manage_system_settings,
            active
        } = req.body;

        // Validate required fields
        if (!name || !display_name) {
            return res.status(400).json({
                message: "Name and display name are required"
            });
        }

        // Check if role name already exists
        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) {
            return res.status(400).json({
                message: "Role name already exists"
            });
        }

        const role = await Role.create({
            name,
            display_name,
            description,
            hierarchy_level: hierarchy_level || 999,
            // Hierarchical permissions - 'none', 'subordinates', 'all'
            can_approve_leave: can_approve_leave || 'none',
            can_approve_onduty: can_approve_onduty || 'none',
            can_approve_timeoff: can_approve_timeoff || 'none',
            can_manage_users: can_manage_users || 'none',
            can_view_users: can_view_users || 'none',
            can_view_reports: can_view_reports || 'none',
            can_manage_active_onduty: can_manage_active_onduty || 'none',
            can_manage_schedule: can_manage_schedule || 'none',
            can_view_activities: can_view_activities || 'none',
            // Global permissions - boolean
            can_manage_leave_types: can_manage_leave_types || false,
            can_access_webapp: can_access_webapp || false,
            can_manage_roles: can_manage_roles || false,
            can_manage_email_settings: can_manage_email_settings || false,
            can_manage_system_settings: can_manage_system_settings || 'none',
            active: active !== undefined ? active : true
        });

        res.status(201).json({
            message: "Role created successfully",
            role
        });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({
            message: "Error creating role",
            error: error.message
        });
    }
};

// Update role
exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            name,
            display_name,
            description,
            hierarchy_level,
            can_approve_leave,
            can_approve_onduty,
            can_approve_timeoff,
            can_manage_users,
            can_view_users,
            can_manage_leave_types,
            can_view_reports,
            can_manage_active_onduty,
            can_manage_schedule,
            can_view_activities,
            can_access_webapp,
            can_manage_roles,
            can_manage_email_settings,
            can_manage_system_settings,
            active
        } = req.body;

        const role = await Role.findByPk(id);

        if (!role) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Hierarchy check: prevent self-privilege escalation
        // Fetch the caller's role to check their hierarchy level
        const currentUser = await User.findByPk(req.userId);
        const callerRole = currentUser?.role ? await Role.findByPk(currentUser.role) : null;

        // Only Super Admin (level 0) can modify any role
        // Other role managers cannot modify roles with equal or higher authority
        if (callerRole && callerRole.hierarchy_level > 0) {
            // Block modification of roles with equal or higher authority (same or lower hierarchy_level number)
            if (role.hierarchy_level <= callerRole.hierarchy_level) {
                return res.status(403).json({
                    message: "You don't have permission to modify a role with equal or higher authority."
                });
            }

            // If updating hierarchy_level, ensure it's not being set to equal or higher authority
            if (hierarchy_level !== undefined && hierarchy_level <= callerRole.hierarchy_level) {
                return res.status(403).json({
                    message: `You cannot set a role's hierarchy level to ${hierarchy_level}. You can only assign levels greater than your own (${callerRole.hierarchy_level}).`
                });
            }
        }

        // Check if new name conflicts with existing role
        if (name && name !== role.name) {
            const existingRole = await Role.findOne({
                where: {
                    name,
                    id: { [Op.ne]: id }
                }
            });
            if (existingRole) {
                return res.status(400).json({
                    message: "Role name already exists"
                });
            }
        }

        await role.update({
            name: name || role.name,
            display_name: display_name || role.display_name,
            description: description !== undefined ? description : role.description,
            hierarchy_level: hierarchy_level !== undefined ? hierarchy_level : role.hierarchy_level,
            can_approve_leave: can_approve_leave !== undefined ? can_approve_leave : role.can_approve_leave,
            can_approve_onduty: can_approve_onduty !== undefined ? can_approve_onduty : role.can_approve_onduty,
            can_approve_timeoff: can_approve_timeoff !== undefined ? can_approve_timeoff : role.can_approve_timeoff,
            can_manage_users: can_manage_users !== undefined ? can_manage_users : role.can_manage_users,
            can_view_users: can_view_users !== undefined ? can_view_users : role.can_view_users,
            can_manage_leave_types: can_manage_leave_types !== undefined ? can_manage_leave_types : role.can_manage_leave_types,
            can_view_reports: can_view_reports !== undefined ? can_view_reports : role.can_view_reports,
            can_manage_active_onduty: can_manage_active_onduty !== undefined ? can_manage_active_onduty : role.can_manage_active_onduty,
            can_manage_schedule: can_manage_schedule !== undefined ? can_manage_schedule : role.can_manage_schedule,
            can_view_activities: can_view_activities !== undefined ? can_view_activities : role.can_view_activities,
            can_access_webapp: can_access_webapp !== undefined ? can_access_webapp : role.can_access_webapp,
            can_manage_roles: can_manage_roles !== undefined ? can_manage_roles : role.can_manage_roles,
            can_manage_email_settings: can_manage_email_settings !== undefined ? can_manage_email_settings : role.can_manage_email_settings,
            can_manage_system_settings: can_manage_system_settings !== undefined ? can_manage_system_settings : role.can_manage_system_settings,
            active: active !== undefined ? active : role.active
        });

        res.json({
            message: "Role updated successfully",
            role
        });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({
            message: "Error updating role",
            error: error.message
        });
    }
};

// Delete role
exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        // Check if role exists
        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Check if any users are assigned to this role
        const usersWithRole = await User.count({ where: { role: id } });
        if (usersWithRole > 0) {
            return res.status(400).json({
                message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role.`,
                users_count: usersWithRole
            });
        }

        await role.destroy();

        res.json({
            message: "Role deleted successfully"
        });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({
            message: "Error deleting role",
            error: error.message
        });
    }
};

// Update hierarchy levels (bulk update for reordering)
exports.updateHierarchy = async (req, res) => {
    try {
        const { roles } = req.body; // Array of { id, hierarchy_level }

        if (!roles || !Array.isArray(roles)) {
            return res.status(400).json({
                message: "Invalid request. Expected array of roles with id and hierarchy_level"
            });
        }

        // Update each role's hierarchy level
        await Promise.all(
            roles.map(async (roleData) => {
                const role = await Role.findByPk(roleData.id);
                if (role) {
                    await role.update({ hierarchy_level: roleData.hierarchy_level });
                }
            })
        );

        res.json({
            message: "Hierarchy updated successfully"
        });
    } catch (error) {
        console.error('Error updating hierarchy:', error);
        res.status(500).json({
            message: "Error updating hierarchy",
            error: error.message
        });
    }
};

// Get role statistics (count of users per role)
exports.getStatistics = async (req, res) => {
    try {
        const roles = await Role.findAll({
            attributes: [
                'id',
                'name',
                'display_name',
                'hierarchy_level',
                [db.sequelize.fn('COUNT', db.sequelize.col('users.staffid')), 'user_count']
            ],
            include: [{
                model: User,
                attributes: [],
                required: false
            }],
            group: ['roles.id'],
            order: [['hierarchy_level', 'ASC']]
        });

        res.json(roles);
    } catch (error) {
        console.error('Error fetching role statistics:', error);
        res.status(500).json({
            message: "Error fetching role statistics",
            error: error.message
        });
    }
};

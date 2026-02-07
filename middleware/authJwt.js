const jwt = require("jsonwebtoken");
const config = process.env;

verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({
            message: "No token provided!"
        });
    }

    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                message: "Unauthorized!"
            });
        }
        req.userId = decoded.id;
        next();
    });
};

const db = require("../models");
const User = db.user;
const Role = db.roles;

/**
 * Middleware to check if user has approval permissions (can approve leave or onduty)
 * This replaces the old hardcoded isManagerOrAdmin check
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
isManagerOrAdmin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database and check permissions
        // For enum permissions, check if they're not 'none'
        const role = await Role.findByPk(user.role);
        if (role && (
            (role.can_approve_leave && role.can_approve_leave !== 'none') ||
            (role.can_approve_onduty && role.can_approve_onduty !== 'none') ||
            (role.can_manage_users && role.can_manage_users !== 'none')
        )) {
            next();
            return;
        }

        res.status(403).send({
            message: "Require Manager or Admin Role!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

/**
 * Middleware to check if user has admin permissions (can manage users)
 * This replaces the old hardcoded isAdmin check
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
isAdmin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database and check can_manage_users permission
        // For enum, check if it's 'all' (full admin access)
        const role = await Role.findByPk(user.role);
        if (role && role.can_manage_users === 'all') {
            next();
            return;
        }

        res.status(403).send({
            message: "Require Admin Role!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

/**
 * Middleware to check if user can access webapp
 * Based on role hierarchy or any management/approval permissions
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
canAccessWebApp = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database
        const role = await Role.findByPk(user.role);
        if (role && (
            role.can_access_webapp ||
            (role.can_approve_leave && role.can_approve_leave !== 'none') ||
            (role.can_approve_onduty && role.can_approve_onduty !== 'none') ||
            (role.can_manage_users && role.can_manage_users !== 'none') ||
            role.can_manage_leave_types ||
            (role.can_view_reports && role.can_view_reports !== 'none')
        )) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to access this system!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

/**
 * Middleware to check if user can manage leave types
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
canManageLeaveTypes = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database and check can_manage_leave_types permission
        const role = await Role.findByPk(user.role);
        if (role && role.can_manage_leave_types === true) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to manage leave types!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

/**
 * Middleware to check if user can view activities
 * Stores the permission level in req.activityPermission for use in controller
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
canViewActivities = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database and check can_view_activities permission
        const role = await Role.findByPk(user.role);
        if (role && role.can_view_activities && role.can_view_activities !== 'none') {
            req.activityPermission = role.can_view_activities;
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to view activities!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageRoles = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database and check can_manage_roles permission
        const role = await Role.findByPk(user.role);
        if (role && role.can_manage_roles === true) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to manage roles!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageEmailSettings = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database and check can_manage_email_settings permission
        const role = await Role.findByPk(user.role);
        if (role && role.can_manage_email_settings === true) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to manage email settings!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageUsers = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database
        const role = await Role.findByPk(user.role);
        if (role && (role.can_manage_users === 'all' || role.can_manage_users === 'subordinates')) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to manage users!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

/**
 * Middleware to check if user can view users (read-only access)
 * Allows access if user has can_view_users OR can_manage_users permission
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
const canViewUsers = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database
        const role = await Role.findByPk(user.role);
        // Allow if user has view OR manage permission
        if (role && (
            role.can_view_users === 'all' || role.can_view_users === 'subordinates' ||
            role.can_manage_users === 'all' || role.can_manage_users === 'subordinates'
        )) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to view users!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canViewReports = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database
        const role = await Role.findByPk(user.role);
        if (role && (role.can_view_reports === 'all' || role.can_view_reports === 'subordinates')) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to view reports!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageActiveOnDuty = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database
        const role = await Role.findByPk(user.role);
        if (role && (role.can_manage_active_onduty === 'all' || role.can_manage_active_onduty === 'subordinates')) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to manage active on-duty!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageSchedule = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }

        // Get role from database
        const role = await Role.findByPk(user.role);
        if (role && (role.can_manage_schedule === 'all' || role.can_manage_schedule === 'subordinates')) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to view/manage schedule!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const authJwt = {
    verifyToken: verifyToken,
    isManagerOrAdmin: isManagerOrAdmin,
    isAdmin: isAdmin,
    canAccessWebApp: canAccessWebApp,
    canManageLeaveTypes: canManageLeaveTypes,
    canViewActivities: canViewActivities,
    canManageRoles: canManageRoles,
    canManageEmailSettings: canManageEmailSettings,
    canManageUsers: canManageUsers,
    canViewUsers: canViewUsers,
    canViewReports: canViewReports,
    canManageActiveOnDuty: canManageActiveOnDuty,
    canManageSchedule: canManageSchedule
};
module.exports = authJwt;

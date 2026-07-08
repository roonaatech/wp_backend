const jwt = require("jsonwebtoken");
const config = process.env;

const verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"] || req.query.token;

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
        req.isServiceAccount = !!decoded.isServiceAccount;
        next();
    });
};

const db = require("../models");
const User = db.user;
const Role = db.roles;

/**
 * Helper to fetch Role based on whether it is a Service Account or a standard User.
 * Ensures the account/user is active before granting role access.
 */
const getRoleForRequest = async (req) => {
    const userId = req.userId;
    if (!userId) return null;

    if (req.isServiceAccount) {
        const account = await db.service_accounts.findByPk(userId);
        if (!account || !account.active) return null;
        return await Role.findByPk(account.role_id);
    } else {
        const user = await User.findByPk(userId);
        if (!user || user.active == 0 || user.active === false || user.active === '0') return null;
        return await Role.findByPk(user.role);
    }
};

/**
 * Middleware to check if user has approval permissions (can approve leave or onduty)
 * This replaces the old hardcoded isManagerOrAdmin check
 * NOTE: Legacy admin flag has been deprecated - all permissions are now role-based
 */
const isManagerOrAdmin = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        // For enum permissions, check if they're not 'none'
        if (
            (role.can_approve_leave && role.can_approve_leave !== 'none') ||
            (role.can_approve_onduty && role.can_approve_onduty !== 'none') ||
            (role.can_approve_timeoff && role.can_approve_timeoff !== 'none') ||
            (role.can_manage_users && role.can_manage_users !== 'none')
        ) {
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
const isAdmin = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        // For enum, check if it's 'all' (full admin access)
        if (role.can_manage_users === 'all') {
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
const canAccessWebApp = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (
            role.can_access_webapp ||
            (role.can_approve_leave && role.can_approve_leave !== 'none') ||
            (role.can_approve_onduty && role.can_approve_onduty !== 'none') ||
            (role.can_approve_timeoff && role.can_approve_timeoff !== 'none') ||
            (role.can_manage_users && role.can_manage_users !== 'none') ||
            role.can_manage_leave_types ||
            (role.can_view_reports && role.can_view_reports !== 'none')
        ) {
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
const canManageLeaveTypes = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_leave_types == true) {
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
const canViewActivities = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_view_activities && role.can_view_activities !== 'none') {
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_roles == true) {
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_email_settings == true) {
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_users === 'all' || role.can_manage_users === 'subordinates') {
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

const canManageOnboarding = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_onboarding === true) {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to manage onboarding!"
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        // Allow if user has view OR manage permission
        if (
            role.can_view_users === 'all' || role.can_view_users === 'subordinates' ||
            role.can_manage_users === 'all' || role.can_manage_users === 'subordinates'
        ) {
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_view_reports === 'all' || role.can_view_reports === 'subordinates') {
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_active_onduty === 'all' || role.can_manage_active_onduty === 'subordinates') {
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

const canApproveTimeOff = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_approve_timeoff === 'all' || role.can_approve_timeoff === 'subordinates') {
            next();
            return;
        }

        res.status(403).send({
            message: "You don't have permission to approve time-off requests!"
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
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_schedule === 'all' || role.can_manage_schedule === 'subordinates') {
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

const canAccessAttendancePortal = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_access_attendance_portal == true) {
            next();
            return;
        }
        res.status(403).send({
            message: "You don't have permission to access the attendance portal!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canViewAttendanceReport = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_view_attendance_report === 'all' || role.can_view_attendance_report === 'subordinates') {
            next();
            return;
        }
        res.status(403).send({
            message: "You don't have permission to view attendance reports!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageAttendance = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_attendance === 'all' || role.can_manage_attendance === 'subordinates') {
            next();
            return;
        }
        res.status(403).send({
            message: "You don't have permission to manage attendance records!"
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).send({
            message: "Unable to validate User role!"
        });
    }
};

const canManageServiceAccounts = async (req, res, next) => {
    try {
        const role = await getRoleForRequest(req);
        if (!role) {
            return res.status(403).send({ message: "User or Role not found or account is inactive." });
        }

        if (role.can_manage_service_accounts == true) {
            next();
            return;
        }
        res.status(403).send({
            message: "You don't have permission to manage service accounts!"
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
    canManageServiceAccounts: canManageServiceAccounts,
    canManageOnboarding: canManageOnboarding,
    canViewUsers: canViewUsers,
    canViewReports: canViewReports,
    canManageActiveOnDuty: canManageActiveOnDuty,
    canManageSchedule: canManageSchedule,
    canApproveTimeOff: canApproveTimeOff,
    canAccessAttendancePortal: canAccessAttendancePortal,
    canViewAttendanceReport: canViewAttendanceReport,
    canManageAttendance: canManageAttendance,
    canManageSystemSettings: async (req, res, next) => {
        try {
            const role = await getRoleForRequest(req);
            if (!role) {
                return res.status(403).send({ message: "User or Role not found or account is inactive." });
            }

            if (role.can_manage_system_settings === 'all') {
                next();
                return;
            }

            res.status(403).send({
                message: "You don't have permission to manage system settings!"
            });
        } catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(500).send({
                message: "Unable to validate User role!"
            });
        }
    }
};
module.exports = authJwt;

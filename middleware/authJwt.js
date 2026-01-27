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
 */
isManagerOrAdmin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }
        
        // Legacy admin flag check
        if (user.admin === 1) {
            next();
            return;
        }
        
        // Get role from database and check permissions
        const role = await Role.findByPk(user.role);
        if (role && (role.can_approve_leave || role.can_approve_onduty || role.can_manage_users)) {
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
 */
isAdmin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }
        
        // Legacy admin flag check
        if (user.admin === 1) {
            next();
            return;
        }
        
        // Get role from database and check can_manage_users permission
        const role = await Role.findByPk(user.role);
        if (role && role.can_manage_users) {
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
 */
canAccessWebApp = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(403).send({ message: "User not found!" });
        }
        
        // Legacy admin flag check
        if (user.admin === 1) {
            next();
            return;
        }
        
        // Get role from database
        const role = await Role.findByPk(user.role);
        if (role && (
            role.can_approve_leave || 
            role.can_approve_onduty || 
            role.can_manage_users || 
            role.can_manage_leave_types || 
            role.can_view_reports ||
            role.hierarchy_level <= 3
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

const authJwt = {
    verifyToken: verifyToken,
    isManagerOrAdmin: isManagerOrAdmin,
    isAdmin: isAdmin,
    canAccessWebApp: canAccessWebApp
};
module.exports = authJwt;

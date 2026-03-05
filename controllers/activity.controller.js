const db = require("../models");
const ActivityLog = db.activity_logs;
const User = db.user;
const { Op } = require("sequelize");

/**
 * Helper function to get subordinate user IDs
 */
const getSubordinateIds = async (userId) => {
    const subordinates = await User.findAll({
        where: { approving_manager_id: userId },
        attributes: ['staffid'],
        raw: true
    });
    return subordinates.map(s => s.staffid);
};

/**
 * Get all activity logs (based on can_view_activities permission)
 */
exports.getAllActivities = async (req, res) => {
    try {
        const { action, entity, admin_id, affected_user_id, startDate, endDate, page = 1, limit = 20 } = req.query;

        // Build filter
        let where = {};

        // Apply hierarchical filtering based on permission level
        if (req.activityPermission === 'subordinates') {
            // Get subordinate user IDs
            const subordinateIds = await getSubordinateIds(req.userId);
            // Include activities performed by subordinates OR activities affecting subordinates
            // Also include the user's own activities
            subordinateIds.push(req.userId);
            where[Op.or] = [
                { admin_id: { [Op.in]: subordinateIds } },
                { affected_user_id: { [Op.in]: subordinateIds } }
            ];
        }
        // 'all' permission has no restriction

        if (action) where.action = action;
        if (entity) where.entity = entity;
        if (admin_id) where.admin_id = parseInt(admin_id);
        if (affected_user_id) where.affected_user_id = parseInt(affected_user_id);

        // Handle date filtering - convert to UTC ISO format for reliable comparison
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                // Parse as local date and convert to start of day
                // Format: YYYY-MM-DD -> 2025-12-10 becomes 2025-12-10T00:00:00Z
                const startISO = startDate + 'T00:00:00Z';
                where.createdAt[db.Sequelize.Op.gte] = new Date(startISO);
            }
            if (endDate) {
                // Parse as local date and convert to end of day
                // Format: YYYY-MM-DD -> 2025-12-10 becomes 2025-12-10T23:59:59.999Z
                const endISO = endDate + 'T23:59:59.999Z';
                where.createdAt[db.Sequelize.Op.lte] = new Date(endISO);
            }
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await ActivityLog.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    attributes: ['staffid', 'firstname', 'lastname', 'email', 'role'],
                    as: 'admin',
                    foreignKey: 'admin_id'
                },
                {
                    model: User,
                    attributes: ['staffid', 'firstname', 'lastname', 'email', 'role'],
                    as: 'affected_user',
                    foreignKey: 'affected_user_id'
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            raw: false
        });

        return res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

/**
 * Get activity summary (counts by action/entity)
 */
exports.getActivitySummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let where = {};

        // Apply hierarchical filtering based on permission level
        if (req.activityPermission === 'subordinates') {
            const subordinateIds = await getSubordinateIds(req.userId);
            subordinateIds.push(req.userId);
            where[Op.or] = [
                { admin_id: { [Op.in]: subordinateIds } },
                { affected_user_id: { [Op.in]: subordinateIds } }
            ];
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                // Parse as local date and convert to start of day
                // Format: YYYY-MM-DD -> 2025-12-10 becomes 2025-12-10T00:00:00Z
                const startISO = startDate + 'T00:00:00Z';
                where.createdAt[db.Sequelize.Op.gte] = new Date(startISO);
            }
            if (endDate) {
                // Parse as local date and convert to end of day
                // Format: YYYY-MM-DD -> 2025-12-10 becomes 2025-12-10T23:59:59.999Z
                const endISO = endDate + 'T23:59:59.999Z';
                where.createdAt[db.Sequelize.Op.lte] = new Date(endISO);
            }
        }

        // Get actions count
        const actionCounts = await ActivityLog.findAll({
            where,
            attributes: [
                'action',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['action'],
            raw: true
        });

        // Get entity counts
        const entityCounts = await ActivityLog.findAll({
            where,
            attributes: [
                'entity',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['entity'],
            raw: true
        });

        // Get top users
        const topUsers = await ActivityLog.findAll({
            where,
            attributes: [
                'admin_id',
                [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
            ],
            group: ['admin_id'],
            order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
            limit: 5,
            raw: true
        });

        return res.status(200).json({
            success: true,
            data: {
                actionCounts,
                entityCounts,
                topUsers
            }
        });
    } catch (error) {
        console.error('Error fetching activity summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching activity summary',
            error: error.message
        });
    }
};

/**
 * Get user's activity history
 */
exports.getUserActivityHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        // Check if user has permission to view this user's activities
        if (req.activityPermission === 'subordinates') {
            const subordinateIds = await getSubordinateIds(req.userId);
            subordinateIds.push(req.userId);
            if (!subordinateIds.includes(parseInt(userId))) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view activities of your subordinates'
                });
            }
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await ActivityLog.findAndCountAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { admin_id: parseInt(userId) },
                    { affected_user_id: parseInt(userId) }
                ]
            },
            include: [
                {
                    model: User,
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    as: 'admin',
                    foreignKey: 'admin_id'
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        return res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching user activity history',
            error: error.message
        });
    }
};

/**
 * Export activity logs to CSV
 */
exports.exportActivities = async (req, res) => {
    try {
        const { action, entity, admin_id, affected_user_id, startDate, endDate } = req.query;

        let where = {};

        // Apply hierarchical filtering based on permission level
        if (req.activityPermission === 'subordinates') {
            const subordinateIds = await getSubordinateIds(req.userId);
            subordinateIds.push(req.userId);
            where[Op.or] = [
                { admin_id: { [Op.in]: subordinateIds } },
                { affected_user_id: { [Op.in]: subordinateIds } }
            ];
        }

        if (action) where.action = action;
        if (entity) where.entity = entity;
        if (admin_id) where.admin_id = parseInt(admin_id);
        if (affected_user_id) where.affected_user_id = parseInt(affected_user_id);

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                // Parse as local date and convert to start of day
                // Format: YYYY-MM-DD -> 2025-12-10 becomes 2025-12-10T00:00:00Z
                const startISO = startDate + 'T00:00:00Z';
                where.createdAt[db.Sequelize.Op.gte] = new Date(startISO);
            }
            if (endDate) {
                // Parse as local date and convert to end of day
                // Format: YYYY-MM-DD -> 2025-12-10 becomes 2025-12-10T23:59:59.999Z
                const endISO = endDate + 'T23:59:59.999Z';
                where.createdAt[db.Sequelize.Op.lte] = new Date(endISO);
            }
        }

        const activities = await ActivityLog.findAll({
            where,
            include: [
                {
                    model: User,
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    as: 'admin',
                    foreignKey: 'admin_id'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Generate CSV
        let csv = 'Timestamp,Action,Entity,Admin,Affected User,Description\n';

        activities.forEach(activity => {
            const admin = activity.admin ? `${activity.admin.firstname} ${activity.admin.lastname}` : 'Unknown';
            const d = new Date(activity.createdAt);
            const timestamp = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours() % 12 || 12}:${d.getMinutes().toString().padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
            const description = (activity.description || '').replace(/"/g, '""');

            csv += `"${timestamp}","${activity.action}","${activity.entity}","${admin}","","${description}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
        return res.status(200).send(csv);
    } catch (error) {
        console.error('Error exporting activities:', error);
        return res.status(500).json({
            success: false,
            message: 'Error exporting activity logs',
            error: error.message
        });
    }
};

/**
 * Log activity from mobile app
 * Endpoint: POST /api/activities/mobile-log
 */
exports.logActivityFromMobile = async (req, res) => {
    try {
        const { action, entity, description } = req.body;
        const token = req.headers['x-access-token'];

        if (!action || !entity) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: action, entity'
            });
        }

        // Get IP address (handle proxies)
        const ipAddress = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown';

        const userAgent = req.headers['user-agent'] || 'unknown';

        // Decode token to get user info if needed
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.SECRET_KEY || 'your-secret-key');
                userId = decoded.id;
            } catch (err) {
                // Token invalid or expired, log without user
            }
        }

        // Create activity log
        await ActivityLog.create({
            action: action,
            entity: entity,
            admin_id: userId, // Mobile user performing action
            affected_user_id: userId, // Same user for mobile operations
            description: description || '',
            ip_address: ipAddress,
            user_agent: userAgent
        });

        return res.status(201).json({
            success: true,
            message: 'Activity logged successfully'
        });
    } catch (error) {
        console.error('Error logging mobile activity:', error);
        return res.status(500).json({
            success: false,
            message: 'Error logging activity',
            error: error.message
        });
    }
};

const db = require("../models");

const ActivityLog = db.activity_logs;
const User = db.user;

/**
 * Log an activity to the database
 * @param {Object} params - Activity parameters
 * @param {number} params.admin_id - ID of user performing the action
 * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, etc.)
 * @param {string} params.entity - Entity type (User, LeaveRequest, OnDutyLog, etc.)
 * @param {number} params.entity_id - ID of the affected entity
 * @param {number} params.affected_user_id - ID of the user being affected
 * @param {Object} params.old_values - Old values before update
 * @param {Object} params.new_values - New values after update
 * @param {string} params.description - Human-readable description
 * @param {string} params.ip_address - IP address of requester
 * @param {string} params.user_agent - User agent string
 * @returns {Promise} - Resolves with created activity log
 */
const logActivity = async (params) => {
    try {
        if (!params.admin_id) {
            console.log(`[ACTIVITY] ${params.action} on ${params.entity || 'Entity'}: ${params.description || ''}`);
            return null;
        }
        const activityLog = await ActivityLog.create({
            action: params.action,
            entity: params.entity,
            entity_id: params.entity_id || null,
            admin_id: params.admin_id,
            affected_user_id: params.affected_user_id || null,
            old_values: params.old_values || null,
            new_values: params.new_values || null,
            description: params.description || null,
            ip_address: params.ip_address || null,
            user_agent: params.user_agent || null
        });
        return activityLog;
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - we don't want logging to break the actual operation
        return null;
    }
};

/**
 * Get IP address from request
 */
const getClientIp = (req) => {
    if (!req) return 'unknown';
    return (req.headers && req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null) || 
           req.socket?.remoteAddress || 
           req.connection?.remoteAddress || 
           'unknown';
};

/**
 * Get user agent from request
 */
const getUserAgent = (req) => {
    if (!req || !req.headers) return 'unknown';
    return req.headers['user-agent'] || 'unknown';
};

module.exports = {
    logActivity,
    getClientIp,
    getUserAgent
};

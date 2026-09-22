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

/**
 * Detect client login device from express request:
 * Returns: "Web", "Mob App", or "Mob Browser"
 * @param {Object} req - Express request
 * @returns {string} - "Web" | "Mob App" | "Mob Browser"
 */
const getClientDevice = (req) => {
    if (!req) return 'Web';
    const ua = getUserAgent(req);
    const body = req.body || {};
    const headers = req.headers || {};

    const isMobileApp = body.is_mobile_app === true ||
                        body.client_type === 'mobile_app' ||
                        headers['x-client-type'] === 'mobile-app' ||
                        /Dart|Flutter|WorkPulseMobile/i.test(ua);
    if (isMobileApp) return 'Mob App';

    const isMobileBrowser = body.client_type === 'mobile_browser' ||
                            headers['sec-ch-ua-mobile'] === '?1' ||
                            /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    if (isMobileBrowser) return 'Mob Browser';

    return 'Web';
};

/**
 * Detect device from activity log object (checking new_values, description, or user_agent)
 * @param {Object} activity - Activity log instance or plain object
 * @returns {string} - "Web" | "Mob App" | "Mob Browser"
 */
const detectDeviceFromActivity = (activity) => {
    if (!activity) return 'Web';

    let newVals = activity.new_values;
    if (typeof newVals === 'string') {
        try { newVals = JSON.parse(newVals); } catch (_) { newVals = null; }
    }
    if (newVals?.login_device) return newVals.login_device;

    const desc = activity.description || '';
    if (desc.includes('(Mob App)') || desc.includes('via Mob App')) return 'Mob App';
    if (desc.includes('(Mob Browser)') || desc.includes('via Mob Browser')) return 'Mob Browser';
    if (desc.includes('(Web)') || desc.includes('via Web')) return 'Web';

    const ua = activity.user_agent || '';
    if (/Dart|Flutter|WorkPulseMobile/i.test(ua)) return 'Mob App';
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mob Browser';

    return 'Web';
};

module.exports = {
    logActivity,
    getClientIp,
    getUserAgent,
    getClientDevice,
    detectDeviceFromActivity
};

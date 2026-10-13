const db = require('../models');
const Setting = db.settings;

// In-memory cache for fast lookup with TTL
let attendanceEnabledCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000; // 5-second cache to avoid unnecessary DB queries on high-frequency routes

async function isAttendanceModuleEnabled() {
    const now = Date.now();
    if (attendanceEnabledCache !== null && (now - lastCacheTime < CACHE_TTL_MS)) {
        return attendanceEnabledCache;
    }

    try {
        const setting = await Setting.findOne({ where: { key: 'module_attendance_enabled' } });
        if (!setting) {
            attendanceEnabledCache = true; // default enabled if not configured
        } else {
            attendanceEnabledCache = String(setting.value).toLowerCase() !== 'false';
        }
        lastCacheTime = now;
        return attendanceEnabledCache;
    } catch (e) {
        console.error('Error checking module_attendance_enabled:', e);
        return true; // fail-open on transient database query errors
    }
}

function invalidateAttendanceModuleCache() {
    attendanceEnabledCache = null;
    lastCacheTime = 0;
}

const requireAttendanceModule = async (req, res, next) => {
    const enabled = await isAttendanceModuleEnabled();
    if (!enabled) {
        return res.status(403).json({
            message: "The Attendance module is currently disabled by administrator.",
            module: "attendance",
            disabled: true
        });
    }
    next();
};

module.exports = {
    isAttendanceModuleEnabled,
    invalidateAttendanceModuleCache,
    requireAttendanceModule
};

const db = require('../models');
const Setting = db.settings;

/**
 * Utility to dynamically get attendance configuration from database settings.
 * Ensures working hours / compliance thresholds are never hardcoded and are always
 * derived from the "Attendance Configuration" in system settings.
 */
const getAttendanceConfig = async () => {
    try {
        const [compSetting, startSetting, endSetting] = await Promise.all([
            Setting.findOne({ where: { key: 'attendance_compliance_hours' } }),
            Setting.findOne({ where: { key: 'office_start_time' } }),
            Setting.findOne({ where: { key: 'office_end_time' } })
        ]);

        const startTime = startSetting?.value || '09:30';
        const endTime = endSetting?.value || '18:30';

        let complianceHours = parseFloat(compSetting?.value);

        // If not directly present as a valid number, calculate from office start & end times
        if (isNaN(complianceHours) || complianceHours <= 0) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            complianceHours = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 8;
        }

        return {
            complianceHours,
            startTime,
            endTime
        };
    } catch (e) {
        return {
            complianceHours: 8,
            startTime: '09:30',
            endTime: '18:30'
        };
    }
};

const getComplianceHours = async () => {
    const config = await getAttendanceConfig();
    return config.complianceHours;
};

module.exports = {
    getAttendanceConfig,
    getComplianceHours
};

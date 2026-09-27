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

        // Attendance Configuration in System Settings defines office start and end times.
        // Daily compliance hours must be calculated from the difference between start and end times.
        let complianceHours = null;
        if (startSetting?.value && endSetting?.value) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            if (diff > 0) {
                complianceHours = Math.round((diff / 60) * 100) / 100;
            }
        }

        // Fallback to explicit attendance_compliance_hours setting if office times are not set
        if (!complianceHours || isNaN(complianceHours) || complianceHours <= 0) {
            complianceHours = parseFloat(compSetting?.value);
        }

        // Safe default fallback
        if (isNaN(complianceHours) || complianceHours <= 0) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            complianceHours = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 9;
        }

        // Keep compSetting in database in sync if it differed
        if (compSetting && complianceHours && String(compSetting.value) !== String(complianceHours)) {
            compSetting.value = String(complianceHours);
            await compSetting.save().catch(() => {});
        }

        return {
            complianceHours,
            startTime,
            endTime
        };
    } catch (e) {
        return {
            complianceHours: 9,
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

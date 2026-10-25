const db = require('../models');
const Setting = db.settings;
const { normalizeEmploymentType } = require('./employmentType.util');

/**
 * Utility to dynamically get attendance configuration from database settings.
 * Ensures working hours / compliance thresholds are never hardcoded and are always
 * derived from the "Attendance Configuration" in system settings.
 */
const getAttendanceConfig = async () => {
    try {
        const [compSetting, compPartTimeSetting, startSetting, endSetting, leaveSetting, timeOffSetting] = await Promise.all([
            Setting.findOne({ where: { key: 'attendance_compliance_hours' } }),
            Setting.findOne({ where: { key: 'attendance_compliance_hours_part_time' } }),
            Setting.findOne({ where: { key: 'office_start_time' } }),
            Setting.findOne({ where: { key: 'office_end_time' } }),
            Setting.findOne({ where: { key: 'allowed_leave_per_month' } }),
            Setting.findOne({ where: { key: 'allowed_time_off_per_month' } })
        ]);

        const startTime = startSetting?.value || '09:30';
        const endTime = endSetting?.value || '18:30';

        // Allowed leave & time-off monthly configurations (defaults: 1 day, 2 hours)
        let allowedLeavePerMonth = parseFloat(leaveSetting?.value);
        if (isNaN(allowedLeavePerMonth) || allowedLeavePerMonth < 0) {
            allowedLeavePerMonth = 1;
        }

        let allowedTimeOffPerMonth = parseFloat(timeOffSetting?.value);
        if (isNaN(allowedTimeOffPerMonth) || allowedTimeOffPerMonth < 0) {
            allowedTimeOffPerMonth = 2;
        }

        // Priority 1: Use explicit attendance_compliance_hours configured by admin
        let complianceHours = parseFloat(compSetting?.value);

        // Priority 2: Fallback to difference between office start and end times if not set
        if (isNaN(complianceHours) || complianceHours <= 0) {
            if (startSetting?.value && endSetting?.value) {
                const [sh, sm] = startTime.split(':').map(Number);
                const [eh, em] = endTime.split(':').map(Number);
                const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
                if (diff > 0) {
                    complianceHours = Math.round((diff / 60) * 100) / 100;
                }
            }
        }

        // Priority 3: Safe default fallback
        if (isNaN(complianceHours) || complianceHours <= 0) {
            complianceHours = 9;
        }

        // Part-time compliance hours (default: 4.5 or half of full-time)
        let complianceHoursPartTime = parseFloat(compPartTimeSetting?.value);
        if (isNaN(complianceHoursPartTime) || complianceHoursPartTime <= 0) {
            complianceHoursPartTime = complianceHours ? Math.round((complianceHours / 2) * 100) / 100 : 4.5;
        }

        return {
            complianceHours,
            complianceHoursFullTime: complianceHours,
            complianceHoursPartTime,
            allowedLeavePerMonth,
            allowedTimeOffPerMonth,
            startTime,
            endTime
        };
    } catch (e) {
        return {
            complianceHours: 9,
            complianceHoursFullTime: 9,
            complianceHoursPartTime: 4.5,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2,
            startTime: '09:30',
            endTime: '18:30'
        };
    }
};

const getComplianceHours = async (employmentType = 'Full-time') => {
    const config = await getAttendanceConfig();
    return getComplianceHoursForType(config, employmentType);
};

const getComplianceHoursForType = (config, employmentType) => {
    const normalized = normalizeEmploymentType(employmentType);
    return normalized === 'Part-time' ? (config.complianceHoursPartTime || 4.5) : (config.complianceHoursFullTime || config.complianceHours || 9);
};

module.exports = {
    getAttendanceConfig,
    getComplianceHours,
    getComplianceHoursForType
};


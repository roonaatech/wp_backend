/**
 * Event Overlap and Collision Rules Utility
 *
 * Implements strict business rules governing Leave, Time-Off, On-Duty, and Attendance:
 *
 * 1. For Leave:
 *    - If leave is applied for a day, no time-off, on-duty, or attendance is allowed.
 *
 * 2. For Time-Off:
 *    - Can only be applied if no existing time-off is on that date, no leave applied for the day,
 *      and no on-duty is currently live (or recorded on that day).
 *    - If time-off is applied on a day: leave cannot be applied, on-duty should not be applied.
 *
 * 3. For On-Duty:
 *    - If on-duty is live, no time-off or attendance check-in is allowed.
 *    - On-duty cannot start on a leave day.
 *    - When starting on-duty, if a time-off is in progress, auto-update the time-off end-time
 *      to the on-duty start time.
 *    - Attendance overlap calculation:
 *      * actual attendance = total attendance hours - on-duty overlap
 *      * compliant work hours = actual attendance + total on-duty hours
 *
 * 4. For Attendance:
 *    - Check-in not allowed on leave day.
 *    - Check-in not allowed when on-duty is in progress.
 *    - When checking in for attendance and time-off is in progress, auto-update the time-off
 *      end-time to the attendance check-in time.
 */

const db = require("../models");
const Op = db.Sequelize.Op;
const LeaveRequest = db.leave_requests;
const TimeOffRequest = db.time_off_requests;
const OnDutyLog = db.on_duty_logs;
const AttendanceLog = db.attendance_logs;
const { logActivity } = require("./activity.logger");

/**
 * Converts a time string (HH:MM or HH:MM:SS), Date object, or ISO string to minutes from midnight.
 */
const timeStringToMinutes = (timeVal) => {
    if (timeVal === undefined || timeVal === null || timeVal === '') return null;
    if (typeof timeVal === 'number') return timeVal;
    if (typeof timeVal === 'string') {
        const parts = timeVal.trim().split(':');
        if (parts.length >= 2) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
                return h * 60 + m;
            }
        }
        const d = new Date(timeVal);
        if (!isNaN(d.getTime())) {
            return d.getHours() * 60 + d.getMinutes();
        }
    } else if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
        return timeVal.getHours() * 60 + timeVal.getMinutes();
    }
    return null;
};

/**
 * Ensures a time string is formatted as HH:mm:ss.
 */
const formatToHHMMSS = (timeVal) => {
    if (!timeVal) return '00:00:00';
    if (timeVal instanceof Date) {
        const h = String(timeVal.getHours()).padStart(2, '0');
        const m = String(timeVal.getMinutes()).padStart(2, '0');
        const s = String(timeVal.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
    const str = String(timeVal).trim();
    const parts = str.split(':');
    if (parts.length === 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    }
    if (parts.length >= 3) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].substring(0, 2).padStart(2, '0')}`;
    }
    return str;
};

/**
 * Checks whether applying or updating a leave request conflicts with existing events.
 *
 * @param {number} staffId - Staff ID
 * @param {string} minDate - Earliest date (YYYY-MM-DD)
 * @param {string} maxDate - Latest date (YYYY-MM-DD)
 * @param {number|null} excludeLeaveId - Leave ID to exclude when editing
 * @returns {Promise<{ conflict: boolean, type?: string, message?: string }>}
 */
async function checkLeaveConflict(staffId, minDate, maxDate, excludeLeaveId = null) {
    // 1. Check Attendance Check-in on any of the dates
    const attendedLog = await AttendanceLog.findOne({
        where: {
            staff_id: staffId,
            date: { [Op.between]: [minDate, maxDate] },
            check_in_time: { [Op.ne]: null }
        },
        order: [['date', 'ASC']]
    });

    if (attendedLog) {
        return {
            conflict: true,
            type: 'ATTENDANCE',
            message: `Attendance check-in has already been recorded on ${attendedLog.date}. Leave cannot be applied for days on which attendance has been recorded.`
        };
    }

    // 2. Check Time-Off on any of the dates
    const existingTimeOff = await TimeOffRequest.findOne({
        where: {
            staff_id: staffId,
            date: { [Op.between]: [minDate, maxDate] },
            status: { [Op.in]: ['Pending', 'Approved'] }
        },
        order: [['date', 'ASC']]
    });

    if (existingTimeOff) {
        return {
            conflict: true,
            type: 'TIME_OFF',
            message: `Time-off has already been applied for ${existingTimeOff.date}. Leave cannot be applied for days with existing time-off.`
        };
    }

    // 3. Check On-Duty on any of the dates
    const existingOnDuty = await OnDutyLog.findOne({
        where: {
            staff_id: staffId,
            start_time: { [Op.between]: [`${minDate} 00:00:00`, `${maxDate} 23:59:59`] },
            status: { [Op.ne]: 'Rejected' }
        },
        order: [['start_time', 'ASC']]
    });

    if (existingOnDuty) {
        const odDate = existingOnDuty.start_time
            ? String(existingOnDuty.start_time).split('T')[0].split(' ')[0]
            : minDate;
        return {
            conflict: true,
            type: 'ON_DUTY',
            message: `On-duty has already been recorded for ${odDate}. Leave cannot be applied for days with on-duty.`
        };
    }

    return { conflict: false };
}

/**
 * Checks whether applying or updating time-off conflicts with leave, live on-duty, existing on-duty, or existing time-off.
 *
 * @param {number} staffId - Staff ID
 * @param {string} dateStr - Target date (YYYY-MM-DD)
 * @param {number|null} excludeTimeOffId - Time-off ID to exclude when editing
 * @returns {Promise<{ conflict: boolean, type?: string, message?: string }>}
 */
async function checkTimeOffConflict(staffId, dateStr, excludeTimeOffId = null) {
    // 1. Check if Leave is applied for this day
    const leave = await LeaveRequest.findOne({
        where: {
            staff_id: staffId,
            status: { [Op.in]: ['Pending', 'Approved'] },
            start_date: { [Op.lte]: dateStr },
            end_date: { [Op.gte]: dateStr }
        }
    });

    if (leave) {
        return {
            conflict: true,
            type: 'LEAVE',
            message: "Leave has already been applied for this day. Time-off cannot be requested on a leave day."
        };
    }

    // 2. Check if On-Duty is currently live
    const liveOnDuty = await OnDutyLog.findOne({
        where: {
            staff_id: staffId,
            end_time: null
        }
    });

    if (liveOnDuty) {
        return {
            conflict: true,
            type: 'LIVE_ON_DUTY',
            message: "You have an on-duty visit currently in progress. Time-off cannot be applied while on-duty is live."
        };
    }

    // 3. Check if On-Duty exists on this date
    const dateOnDuty = await OnDutyLog.findOne({
        where: {
            staff_id: staffId,
            start_time: { [Op.between]: [`${dateStr} 00:00:00`, `${dateStr} 23:59:59`] },
            status: { [Op.ne]: 'Rejected' }
        }
    });

    if (dateOnDuty) {
        return {
            conflict: true,
            type: 'ON_DUTY',
            message: "On-duty has already been recorded for this day. Time-off cannot be applied on the same day as on-duty."
        };
    }

    // 4. Check if existing Time-Off exists on this day
    const existingWhere = {
        staff_id: staffId,
        date: dateStr,
        status: { [Op.in]: ['Pending', 'Approved'] }
    };
    if (excludeTimeOffId) {
        existingWhere.id = { [Op.ne]: excludeTimeOffId };
    }

    const existingTimeOff = await TimeOffRequest.findOne({ where: existingWhere });
    if (existingTimeOff) {
        return {
            conflict: true,
            type: 'TIME_OFF_EXISTS',
            message: `A time-off request already exists on ${dateStr}. Only one time-off request is allowed per day.`
        };
    }

    return { conflict: false };
}

/**
 * Checks whether starting on-duty is allowed, or if an in-progress time-off should be truncated.
 *
 * @param {number} staffId - Staff ID
 * @param {string} todayStr - Today's date (YYYY-MM-DD)
 * @param {string} currentTimeStr - Current time (HH:mm or HH:mm:ss)
 * @param {Object} reqInfo - Request metadata for activity logging
 * @returns {Promise<{ conflict: boolean, type?: string, message?: string, truncatedTimeOff?: Object }>}
 */
async function checkOnDutyStartConflict(staffId, todayStr, currentTimeStr, reqInfo = {}) {
    // 1. Check if On-Duty is already live
    const liveOnDuty = await OnDutyLog.findOne({
        where: {
            staff_id: staffId,
            end_time: null
        }
    });

    if (liveOnDuty) {
        return {
            conflict: true,
            type: 'LIVE_ON_DUTY',
            message: "You already have an on-duty visit currently in progress. Please complete it before starting a new one."
        };
    }

    // 2. Check if Leave is applied for today
    const leave = await LeaveRequest.findOne({
        where: {
            staff_id: staffId,
            status: { [Op.in]: ['Pending', 'Approved'] },
            start_date: { [Op.lte]: todayStr },
            end_date: { [Op.gte]: todayStr }
        }
    });

    if (leave) {
        return {
            conflict: true,
            type: 'LEAVE',
            message: "Cannot start on-duty on a leave day."
        };
    }

    // 3. Check for Time-Off on today
    const timeOffs = await TimeOffRequest.findAll({
        where: {
            staff_id: staffId,
            date: todayStr,
            status: { [Op.in]: ['Pending', 'Approved'] }
        }
    });

    if (timeOffs.length > 0) {
        const currentMins = timeStringToMinutes(currentTimeStr);
        let inProgressTimeOff = null;

        for (const to of timeOffs) {
            const startM = timeStringToMinutes(to.start_time);
            const endM = timeStringToMinutes(to.end_time);
            if (startM !== null && endM !== null && currentMins >= startM && currentMins <= endM) {
                inProgressTimeOff = to;
                break;
            }
        }

        if (inProgressTimeOff) {
            // In progress: Truncate time-off end_time to on-duty start time
            const oldEndTime = inProgressTimeOff.end_time;
            const newEndTime = formatToHHMMSS(currentTimeStr);
            inProgressTimeOff.end_time = newEndTime;
            await inProgressTimeOff.save();

            try {
                await logActivity({
                    admin_id: staffId,
                    action: 'UPDATE',
                    entity: 'TimeOffRequest',
                    entity_id: inProgressTimeOff.id,
                    affected_user_id: staffId,
                    description: `Time-off end time updated from ${oldEndTime} to ${newEndTime} due to start of on-duty`,
                    new_values: { end_time: newEndTime },
                    ip_address: reqInfo.ip,
                    user_agent: reqInfo.userAgent
                });
            } catch (logErr) {
                console.error("Error logging time-off truncation:", logErr);
            }

            return { conflict: false, truncatedTimeOff: inProgressTimeOff };
        } else {
            // Time-off exists on this day but is not in progress
            return {
                conflict: true,
                type: 'TIME_OFF_EXISTS',
                message: "Cannot start on-duty: time-off has already been applied for today."
            };
        }
    }

    return { conflict: false };
}

/**
 * Checks whether attendance check-in is allowed, or if an in-progress time-off should be truncated.
 *
 * @param {number} staffId - Staff ID
 * @param {string} todayDateOnly - Date (YYYY-MM-DD)
 * @param {string} currentTimeStr - Current time (HH:mm or HH:mm:ss)
 * @param {Object} reqInfo - Request metadata for activity logging
 * @returns {Promise<{ conflict: boolean, type?: string, message?: string, truncatedTimeOff?: Object }>}
 */
async function checkAttendanceCheckInConflict(staffId, todayDateOnly, currentTimeStr, reqInfo = {}) {
    // 1. Check if Leave is applied for today
    const leave = await LeaveRequest.findOne({
        where: {
            staff_id: staffId,
            status: { [Op.in]: ['Pending', 'Approved'] },
            start_date: { [Op.lte]: todayDateOnly },
            end_date: { [Op.gte]: todayDateOnly }
        }
    });

    if (leave) {
        return {
            conflict: true,
            type: 'LEAVE',
            message: "Attendance check-in is not allowed on a leave day."
        };
    }

    // 2. Check if On-Duty is in progress
    const liveOnDuty = await OnDutyLog.findOne({
        where: {
            staff_id: staffId,
            end_time: null
        }
    });

    if (liveOnDuty) {
        return {
            conflict: true,
            type: 'LIVE_ON_DUTY',
            message: "Attendance check-in is not allowed when on-duty is in progress. Please complete your on-duty visit first."
        };
    }

    // 3. Check if Time-Off is in progress today
    const timeOffs = await TimeOffRequest.findAll({
        where: {
            staff_id: staffId,
            date: todayDateOnly,
            status: { [Op.in]: ['Pending', 'Approved'] }
        }
    });

    if (timeOffs.length > 0) {
        const currentMins = timeStringToMinutes(currentTimeStr);
        let inProgressTimeOff = null;

        for (const to of timeOffs) {
            const startM = timeStringToMinutes(to.start_time);
            const endM = timeStringToMinutes(to.end_time);
            if (startM !== null && endM !== null && currentMins >= startM && currentMins <= endM) {
                inProgressTimeOff = to;
                break;
            }
        }

        if (inProgressTimeOff) {
            // Truncate time-off end_time to attendance check-in time
            const oldEndTime = inProgressTimeOff.end_time;
            const newEndTime = formatToHHMMSS(currentTimeStr);
            inProgressTimeOff.end_time = newEndTime;
            await inProgressTimeOff.save();

            try {
                await logActivity({
                    admin_id: staffId,
                    action: 'UPDATE',
                    entity: 'TimeOffRequest',
                    entity_id: inProgressTimeOff.id,
                    affected_user_id: staffId,
                    description: `Time-off end time updated from ${oldEndTime} to ${newEndTime} due to attendance check-in`,
                    new_values: { end_time: newEndTime },
                    ip_address: reqInfo.ip,
                    user_agent: reqInfo.userAgent
                });
            } catch (logErr) {
                console.error("Error logging time-off truncation:", logErr);
            }

            return { conflict: false, truncatedTimeOff: inProgressTimeOff };
        }
    }

    return { conflict: false };
}

module.exports = {
    checkLeaveConflict,
    checkTimeOffConflict,
    checkOnDutyStartConflict,
    checkAttendanceCheckInConflict,
    timeStringToMinutes,
    formatToHHMMSS
};

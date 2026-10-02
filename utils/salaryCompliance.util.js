/**
 * Salary Consideration & Compliance Calculation Utility
 *
 * Implements the chronological day-by-day evaluation engine to determine
 * the number of payable salary days (compliant days) for an employee in a month.
 *
 * Rules:
 * 1. Monthly Quotas:
 *    - allowed_leave_per_month (default: 1 day)
 *    - allowed_time_off_per_month (default: 2 hours)
 *    - compliance_hours (daily threshold, default: 9 hours)
 * 2. Working Days:
 *    - Effective Work Time = Attendance Hours + On-Duty Hours + Credited Time-Off
 *    - Time-Off is credited up to remaining monthly allowed time-off quota.
 *    - If Effective Work Time >= Daily Compliance Hours => Compliant (1 Day).
 *    - Else => Non-Compliant (0 Days).
 * 3. Leave Days:
 *    - Evaluated chronologically.
 *    - Leaves within remaining monthly leave quota => Compliant (Paid).
 *    - Leaves beyond quota => Non-Compliant (Unpaid).
 */

const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

const getWeekday = (dateStr) => {
    if (!dateStr) return '';
    try {
        const parts = String(dateStr).split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return days[d.getDay()];
        }
    } catch (e) {}
    return '';
};

/**
 * Calculates monthly salary compliance and daily audit breakdown for an employee.
 *
 * @param {Object} employeeRecords
 * @param {Array} employeeRecords.attendanceRecords - Attendance sessions [{ date, work_minutes, check_in_time, check_out_time, ... }]
 * @param {Array} employeeRecords.leaveDays - Daily expanded leaves [{ date, days: 1.0|0.5, leave_type, reason }]
 * @param {Array} employeeRecords.timeoffRecords - Approved time-offs [{ date, minutes, start_time, end_time, reason }]
 * @param {Array} employeeRecords.ondutyRecords - Approved on-duties [{ date, minutes, start_time, end_time, location }]
 * @param {Object} config
 * @param {number} config.complianceHours - Daily target hours (e.g. 9)
 * @param {number} config.allowedLeavePerMonth - Allowed paid leaves per month (e.g. 1)
 * @param {number} config.allowedTimeOffPerMonth - Allowed time-off hours per month (e.g. 2)
 */
function calculateMonthlyCompliance(employeeRecords = {}, config = {}) {
    const complianceHours = config.complianceHours && config.complianceHours > 0 ? Number(config.complianceHours) : 9;
    const allowedLeaveDays = config.allowedLeavePerMonth !== undefined && config.allowedLeavePerMonth >= 0 ? Number(config.allowedLeavePerMonth) : 1;
    const allowedTimeOffHours = config.allowedTimeOffPerMonth !== undefined && config.allowedTimeOffPerMonth >= 0 ? Number(config.allowedTimeOffPerMonth) : 2;

    const allowedTimeOffMins = Math.round(allowedTimeOffHours * 60);
    const targetDailyMins = Math.round(complianceHours * 60);

    const attendanceList = employeeRecords.attendanceRecords || [];
    const leaveList = employeeRecords.leaveDays || [];
    const timeoffList = employeeRecords.timeoffRecords || [];
    const ondutyList = employeeRecords.ondutyRecords || [];

    const holidaysMap = new Map();
    if (config.holidays) {
        if (config.holidays instanceof Map) {
            config.holidays.forEach((val, key) => holidaysMap.set(key, val));
        } else if (Array.isArray(config.holidays)) {
            config.holidays.forEach(h => {
                const d = h.holiday_date || h.date;
                const name = h.holiday_name || h.name || 'Holiday';
                if (d) holidaysMap.set(String(d).split('T')[0], name);
            });
        } else if (typeof config.holidays === 'object') {
            Object.entries(config.holidays).forEach(([k, v]) => holidaysMap.set(k, v));
        }
    }

    // Group activity by date
    const dailyMap = {};

    const ensureDate = (dStr) => {
        if (!dStr) return null;
        if (!dailyMap[dStr]) {
            dailyMap[dStr] = {
                date: dStr,
                attMins: 0,
                attSessions: [],
                onDutyMins: 0,
                onDutyRecords: [],
                timeOffRequestedMins: 0,
                timeOffRecords: [],
                leaveDays: 0,
                leaveRecords: [],
                isHoliday: false,
                holidayName: null
            };
        }
        return dailyMap[dStr];
    };

    // Ensure all company holidays are registered in dailyMap
    holidaysMap.forEach((holidayName, holidayDate) => {
        const entry = ensureDate(holidayDate);
        if (entry) {
            entry.isHoliday = true;
            entry.holidayName = holidayName;
        }
    });

    // 1. Attendance Sessions
    attendanceList.forEach(att => {
        const d = att.date;
        if (!d) return;
        const entry = ensureDate(d);
        const mins = Number(att.work_minutes) || 0;
        entry.attMins += mins;
        entry.attSessions.push(att);
    });

    // 2. On-Duty Records
    ondutyList.forEach(od => {
        const d = od.date;
        if (!d) return;
        const entry = ensureDate(d);
        const mins = Number(od.minutes) || 0;
        entry.onDutyMins += mins;
        entry.onDutyRecords.push(od);
    });

    // 3. Time-Off Records
    timeoffList.forEach(to => {
        const d = to.date;
        if (!d) return;
        const entry = ensureDate(d);
        const mins = Number(to.minutes) || 0;
        entry.timeOffRequestedMins += mins;
        entry.timeOffRecords.push(to);
    });

    // 4. Leave Records
    leaveList.forEach(lv => {
        const d = lv.date;
        if (!d) return;
        const entry = ensureDate(d);
        const days = Number(lv.days) || 1.0;
        entry.leaveDays += days;
        entry.leaveRecords.push(lv);
    });

    // Sort all dates chronologically
    const sortedDates = Object.keys(dailyMap).sort((a, b) => a.localeCompare(b));

    // Initialize quota trackers
    let remainingLeaveQuota = allowedLeaveDays;
    let remainingTimeOffMins = allowedTimeOffMins;

    let totalCompliantDays = 0.0;
    let totalNonCompliantDays = 0;

    let usedLeaveDays = 0.0;
    let creditedLeaveDaysTotal = 0.0;
    let usedTimeOffMins = 0;
    let creditedTimeOffMinsTotal = 0;

    const dailyBreakdown = [];

    for (const dStr of sortedDates) {
        const day = dailyMap[dStr];
        const weekday = getWeekday(dStr);

        let dayType = 'Present';
        const hasWork = day.attMins > 0 || day.onDutyMins > 0;
        const hasTimeOff = day.timeOffRequestedMins > 0;
        const hasLeave = day.leaveDays > 0;

        if (day.isHoliday) {
            dayType = 'Holiday';
        } else if (hasLeave && (hasWork || hasTimeOff)) {
            dayType = 'Combined';
        } else if (hasLeave) {
            dayType = 'Leave';
        } else if (day.onDutyMins > 0 && day.attMins === 0 && !hasTimeOff) {
            dayType = 'On-Duty';
        } else if (hasTimeOff && day.attMins === 0 && day.onDutyMins === 0) {
            dayType = 'Time-Off';
        }

        // --- Process Leave for this date ---
        let creditedLeave = 0;
        let excessLeave = 0;
        if (hasLeave && !day.isHoliday) {
            usedLeaveDays += day.leaveDays;
            creditedLeave = Math.min(day.leaveDays, remainingLeaveQuota);
            remainingLeaveQuota = Math.max(0, remainingLeaveQuota - creditedLeave);
            creditedLeaveDaysTotal += creditedLeave;
            excessLeave = day.leaveDays - creditedLeave;
        }

        // --- Process Time-Off for this date ---
        let creditedTimeOffMins = 0;
        let excessTimeOffMins = 0;
        if (hasTimeOff && !day.isHoliday) {
            usedTimeOffMins += day.timeOffRequestedMins;
            creditedTimeOffMins = Math.min(day.timeOffRequestedMins, remainingTimeOffMins);
            remainingTimeOffMins = Math.max(0, remainingTimeOffMins - creditedTimeOffMins);
            creditedTimeOffMinsTotal += creditedTimeOffMins;
            excessTimeOffMins = day.timeOffRequestedMins - creditedTimeOffMins;
        }

        // --- Calculate Effective Working Minutes ---
        const effectiveWorkMins = day.attMins + day.onDutyMins + creditedTimeOffMins;

        // --- Decide Day Compliance Outcome ---
        let isCompliant = false;
        let compliantDayValue = 0.0;
        let remarks = '';

        if (day.isHoliday) {
            // Company Holiday - fully compliant paid day
            isCompliant = true;
            compliantDayValue = 1.0;
            remarks = `Company Holiday: ${day.holidayName || 'Holiday'} (Compliant)`;
        } else if (dayType === 'Leave') {
            // Pure leave day
            if (creditedLeave >= 1.0) {
                isCompliant = true;
                compliantDayValue = 1.0;
                remarks = `Approved leave within monthly quota (${creditedLeave} of ${allowedLeaveDays} day(s) allowed)`;
            } else if (creditedLeave > 0) {
                // Partial leave credited (e.g. 0.5 day)
                isCompliant = false; // partial
                compliantDayValue = creditedLeave;
                remarks = `Partial leave credited (${creditedLeave} day(s) paid, ${excessLeave} day(s) unpaid beyond ${allowedLeaveDays} day quota)`;
            } else {
                isCompliant = false;
                compliantDayValue = 0.0;
                remarks = `Leave exceeds monthly allowed quota of ${allowedLeaveDays} day(s) (Unpaid)`;
            }
        } else if (dayType === 'Combined') {
            // Both leave and working activity on same day (e.g. Half-day leave + work)
            const halfDayTargetMins = Math.round(targetDailyMins / 2);
            const workMetHalfDay = effectiveWorkMins >= halfDayTargetMins;
            const leaveCreditedHalfDay = creditedLeave >= 0.5;

            let leaveVal = creditedLeave > 0 ? Math.min(0.5, creditedLeave) : 0;
            let workVal = workMetHalfDay ? 0.5 : 0;
            compliantDayValue = leaveVal + workVal;

            if (compliantDayValue >= 1.0) {
                isCompliant = true;
                remarks = `Full day met: Half-day leave (${creditedLeave}d credited) + Working time (${formatDuration(effectiveWorkMins)} >= ${formatDuration(halfDayTargetMins)})`;
            } else if (compliantDayValue > 0) {
                isCompliant = false;
                remarks = `Partially compliant (${compliantDayValue}d): ${leaveVal > 0 ? `Leave ${leaveVal}d credited` : 'Leave quota exhausted'} | ${workVal > 0 ? `Work met ${formatDuration(halfDayTargetMins)}` : `Work short (${formatDuration(effectiveWorkMins)} < ${formatDuration(halfDayTargetMins)})`}`;
            } else {
                isCompliant = false;
                remarks = `Non-compliant: Leave quota exhausted & working time (${formatDuration(effectiveWorkMins)}) below half-day target`;
            }
        } else {
            // Regular working day (Attendance, On-Duty, Time-Off)
            if (effectiveWorkMins >= targetDailyMins) {
                isCompliant = true;
                compliantDayValue = 1.0;

                const parts = [];
                if (day.attMins > 0) parts.push(`${formatDuration(day.attMins)} Att`);
                if (day.onDutyMins > 0) parts.push(`${formatDuration(day.onDutyMins)} OD`);
                if (creditedTimeOffMins > 0) parts.push(`${formatDuration(creditedTimeOffMins)} Time-Off`);
                
                let details = parts.join(' + ') + ` = ${formatDuration(effectiveWorkMins)} >= ${complianceHours}h target`;
                if (excessTimeOffMins > 0) {
                    details += ` (${formatDuration(excessTimeOffMins)} excess time-off uncredited)`;
                }
                remarks = details;
            } else {
                isCompliant = false;
                compliantDayValue = 0.0;

                const parts = [];
                if (day.attMins > 0) parts.push(`${formatDuration(day.attMins)} Att`);
                if (day.onDutyMins > 0) parts.push(`${formatDuration(day.onDutyMins)} OD`);
                if (creditedTimeOffMins > 0) parts.push(`${formatDuration(creditedTimeOffMins)} Time-Off credited`);
                
                const shortMins = targetDailyMins - effectiveWorkMins;
                let details = (parts.length > 0 ? parts.join(' + ') + ` = ${formatDuration(effectiveWorkMins)}` : '0h') +
                              ` < ${complianceHours}h target (${formatDuration(shortMins)} short)`;

                if (excessTimeOffMins > 0) {
                    details += ` [${formatDuration(excessTimeOffMins)} time-off uncredited due to monthly limit]`;
                }
                remarks = details;
            }
        }

        totalCompliantDays += compliantDayValue;
        if (compliantDayValue >= 1.0) {
            // 1 full compliant day
        } else if (compliantDayValue > 0) {
            // Partial day, count remaining fraction as non-compliant
            totalNonCompliantDays += (1 - compliantDayValue);
        } else {
            totalNonCompliantDays += 1;
        }

        dailyBreakdown.push({
            date: dStr,
            weekday: weekday,
            type: dayType,
            attendance_minutes: day.attMins,
            onduty_minutes: day.onDutyMins,
            timeoff_requested_minutes: day.timeOffRequestedMins,
            timeoff_credited_minutes: creditedTimeOffMins,
            timeoff_excess_minutes: excessTimeOffMins,
            effective_work_minutes: effectiveWorkMins,
            leave_days: day.leaveDays,
            leave_credited: creditedLeave,
            leave_excess: excessLeave,
            is_compliant: isCompliant,
            compliant_day_value: Math.round(compliantDayValue * 10) / 10,
            status_label: compliantDayValue >= 1.0 ? 'Compliant' : (compliantDayValue > 0 ? 'Partial' : 'Non-Compliant'),
            remarks: remarks,
            holiday_name: day.holidayName || null
        });
    }

    return {
        compliant_days: Math.round(totalCompliantDays * 10) / 10,
        non_compliant_days: Math.round(totalNonCompliantDays * 10) / 10,
        holidays_count: holidaysMap.size,
        quota_summary: {
            allowed_leave_days: allowedLeaveDays,
            used_leave_days: Math.round(usedLeaveDays * 10) / 10,
            credited_leave_days: Math.round(creditedLeaveDaysTotal * 10) / 10,
            remaining_leave_days: Math.round(remainingLeaveQuota * 10) / 10,
            allowed_timeoff_minutes: allowedTimeOffMins,
            used_timeoff_minutes: usedTimeOffMins,
            credited_timeoff_minutes: creditedTimeOffMinsTotal,
            remaining_timeoff_minutes: remainingTimeOffMins
        },
        daily_breakdown: dailyBreakdown
    };
}

module.exports = {
    calculateMonthlyCompliance,
    formatDuration,
    getWeekday
};

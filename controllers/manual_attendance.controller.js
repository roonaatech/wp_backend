const db = require('../models');
const { Op } = db.Sequelize;
const AttendanceLog = db.attendance_logs;
const User = db.user;
const Role = db.roles;
const Approval = db.approvals;
const LeaveRequest = db.leave_requests;
const LeaveType = db.leave_types;
const OnDutyLog = db.on_duty_logs;
const Setting = db.settings;
const EmployeeProfile = db.employee_profiles;
const timezoneUtil = require('../utils/timezone.util');
const { logActivity, getClientIp, getUserAgent } = require('../utils/activity.logger');

/**
 * Helper to get the configured application timezone from database settings
 */
const getAppTimezone = async () => {
    try {
        const tzSetting = await Setting.findOne({ where: { key: 'application_timezone' } });
        return tzSetting ? tzSetting.value : 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

const { getAttendanceConfig, getComplianceHours } = require('../utils/attendanceConfig');

/**
 * Helper to get configured office start and end times from settings
 */
const getOfficeTimings = async () => {
    const config = await getAttendanceConfig();
    return {
        startTime: config.startTime,
        endTime: config.endTime
    };
};

/**
 * Helper to calculate checkout time string given checkin time string and compliance hours
 * e.g. ("09:30", 8) => "17:30"
 */
const calculateCheckoutTime = (checkInStr, hours) => {
    try {
        if (!checkInStr) return '17:30';
        const [h, m] = checkInStr.split(':').map(Number);
        const totalMinutes = h * 60 + (m || 0) + Math.round(hours * 60);
        const endH = Math.floor(totalMinutes / 60) % 24;
        const endM = totalMinutes % 60;
        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    } catch (e) {
        return '17:30';
    }
};

/**
 * Format a Date object to "HH:mm" in given timezone
 */
const formatTimeToHHMM = (dateObj, tz = 'Asia/Kolkata') => {
    if (!dateObj) return '';
    try {
        const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
        if (isNaN(d.getTime())) return '';
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(d);
        const hour = parts.find(p => p.type === 'hour')?.value || '00';
        const minute = parts.find(p => p.type === 'minute')?.value || '00';
        return `${hour}:${minute}`;
    } catch (e) {
        return '';
    }
};

/**
 * GET /api/attendance/missed
 * Returns active employees who missed check-in and/or check-out for the given date range.
 */
exports.getMissedAttendance = async (req, res) => {
    try {
        const tz = await getAppTimezone();
        const complianceHours = await getComplianceHours();
        const officeTimes = await getOfficeTimings();

        // Determine date range in application timezone
        const nowInTz = timezoneUtil.getNowStringInTimezone(tz).split(' ')[0]; // YYYY-MM-DD
        const startDate = req.query.startDate || nowInTz;
        const endDate = req.query.endDate || startDate;
        const search = (req.query.search || '').trim().toLowerCase();

        // Validate dates
        const startD = new Date(startDate);
        const endD = new Date(endDate);
        if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
            return res.status(400).send({ message: "Invalid date format. Use YYYY-MM-DD." });
        }
        if (startD > endD) {
            return res.status(400).send({ message: "Start date cannot be after end date." });
        }

        // Limit range to max 31 days to ensure fast response times
        const diffDays = Math.ceil(Math.abs(endD - startD) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 31) {
            return res.status(400).send({ message: "Date range cannot exceed 31 days." });
        }

        // Generate array of date strings [YYYY-MM-DD, ...]
        const datesList = [];
        const cur = new Date(startDate + 'T00:00:00');
        const endLimit = new Date(endDate + 'T00:00:00');
        while (cur <= endLimit) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, '0');
            const d = String(cur.getDate()).padStart(2, '0');
            datesList.push(`${y}-${m}-${d}`);
            cur.setDate(cur.getDate() + 1);
        }

        // Fetch all active staff
        const staffList = await User.findAll({
            where: { active: 1 },
            include: [
                {
                    model: Role,
                    as: 'role_info',
                    attributes: ['id', 'name', 'display_name', 'hierarchy_level']
                },
                {
                    model: EmployeeProfile,
                    as: 'profile_info',
                    attributes: ['image_path']
                }
            ],
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role', 'approving_manager_id'],
            order: [['firstname', 'ASC'], ['lastname', 'ASC']]
        });

        // Filter staff by search if provided
        const filteredStaff = search
            ? staffList.filter(s => {
                const fullName = `${s.firstname || ''} ${s.lastname || ''}`.toLowerCase();
                const email = (s.email || '').toLowerCase();
                const idStr = String(s.staffid);
                return fullName.includes(search) || email.includes(search) || idStr.includes(search);
            })
            : staffList;

        if (filteredStaff.length === 0) {
            return res.status(200).send({
                success: true,
                compliance_hours: complianceHours,
                default_check_in: officeTimes.startTime,
                default_check_out: officeTimes.endTime,
                timezone: tz,
                items: [],
                total_missed: 0
            });
        }

        const staffIds = filteredStaff.map(s => s.staffid);

        // Fetch all attendance logs for these staff in the date range
        const attendanceLogs = await AttendanceLog.findAll({
            where: {
                staff_id: { [Op.in]: staffIds },
                date: { [Op.in]: datesList }
            },
            order: [['date', 'ASC'], ['check_in_time', 'ASC']]
        });

        // Map logs by "staffid_date"
        const logsMap = {};
        attendanceLogs.forEach(log => {
            const key = `${log.staff_id}_${log.date}`;
            if (!logsMap[key]) {
                logsMap[key] = [];
            }
            logsMap[key].push(log);
        });

        // Fetch approved and pending leave requests that overlap the date range
        const leaveRequests = await LeaveRequest.findAll({
            where: {
                staff_id: { [Op.in]: staffIds },
                status: { [Op.in]: ['Approved', 'Pending'] },
                start_date: { [Op.lte]: endDate },
                end_date: { [Op.gte]: startDate }
            }
        });

        // Map leaves by "staffid_date"
        const leaveMap = {};
        leaveRequests.forEach(leave => {
            const isApproved = leave.status === 'Approved';
            const isPending = leave.status === 'Pending';
            const lStart = new Date(leave.start_date + 'T00:00:00');
            const lEnd = new Date(leave.end_date + 'T00:00:00');
            const lCur = new Date(lStart);
            while (lCur <= lEnd) {
                const y = lCur.getFullYear();
                const m = String(lCur.getMonth() + 1).padStart(2, '0');
                const d = String(lCur.getDate()).padStart(2, '0');
                const dStr = `${y}-${m}-${d}`;
                if (datesList.includes(dStr)) {
                    const key = `${leave.staff_id}_${dStr}`;
                    // If an approved leave already mapped for this slot, keep approved
                    if (!leaveMap[key] || (!leaveMap[key].is_approved && isApproved)) {
                        leaveMap[key] = {
                            leave_id: leave.id,
                            leave_type: leave.leave_type || (isPending ? 'Pending Leave' : 'Approved Leave'),
                            status: leave.status, // 'Approved' | 'Pending'
                            is_approved: isApproved,
                            is_pending: isPending,
                            color: isPending ? '#f59e0b' : '#8b5cf6',
                            reason: leave.reason
                        };
                    }
                }
                lCur.setDate(lCur.getDate() + 1);
            }
        });

        // Default timings from office settings
        const defaultCheckIn = officeTimes.startTime;
        const defaultCheckOut = officeTimes.endTime;

        // Build list of missed attendance records
        const missedItems = [];
        const pendingLeavesList = [];

        datesList.forEach(dateStr => {
            filteredStaff.forEach(staff => {
                const key = `${staff.staffid}_${dateStr}`;
                const logs = logsMap[key] || [];
                const leave = leaveMap[key] || null;

                // Check if employee has a completed attendance log (both check_in and check_out)
                const hasCompletedLog = logs.some(l => l.check_in_time && l.check_out_time);

                // If they already have at least one completed record, they didn't miss attendance for this day
                if (hasCompletedLog) {
                    return;
                }

                // Check if there is an open log (check_in exists, check_out missing)
                const openLog = logs.find(l => l.check_in_time && !l.check_out_time);

                let missedType = 'MISSING_ALL'; // Default: missed both checkin and checkout
                let existingCheckInStr = '';
                let existingLogId = null;

                if (openLog) {
                    missedType = 'MISSING_CHECKOUT';
                    existingLogId = openLog.id;
                    existingCheckInStr = formatTimeToHHMM(openLog.check_in_time, tz);
                }

                // Suggested check-in and check-out values
                const suggestedCheckIn = existingCheckInStr || defaultCheckIn;
                const suggestedCheckOut = existingCheckInStr ? calculateCheckoutTime(suggestedCheckIn, complianceHours) : defaultCheckOut;

                const empName = `${staff.firstname || ''} ${staff.lastname || ''}`.trim();
                let finalMissedType = missedType;
                if (leave) {
                    if (leave.is_approved) {
                        finalMissedType = 'ON_LEAVE';
                    } else if (leave.is_pending) {
                        finalMissedType = 'PENDING_LEAVE';
                        pendingLeavesList.push({
                            staff_id: staff.staffid,
                            employee_name: empName,
                            email: staff.email,
                            date: dateStr,
                            leave_id: leave.leave_id,
                            leave_type: leave.leave_type,
                            reason: leave.reason
                        });
                    }
                }

                missedItems.push({
                    id: `${staff.staffid}_${dateStr}`,
                    staff_id: staff.staffid,
                    employee_name: empName,
                    email: staff.email,
                    role_name: staff.role_info?.display_name || staff.role_info?.name || 'Staff',
                    avatar: staff.profile_info?.image_path || null,
                    date: dateStr,
                    missed_type: finalMissedType,
                    existing_log_id: existingLogId,
                    existing_check_in_time: existingCheckInStr,
                    check_in_time: suggestedCheckIn,
                    check_out_time: suggestedCheckOut,
                    reason: 'Work From Home',
                    notes: '',
                    leave_info: leave
                });
            });
        });

        res.status(200).send({
            success: true,
            compliance_hours: complianceHours,
            default_check_in: defaultCheckIn,
            default_check_out: defaultCheckOut,
            timezone: tz,
            total_missed: missedItems.length,
            items: missedItems,
            pending_leaves: pendingLeavesList
        });

    } catch (err) {
        console.error("Error in getMissedAttendance:", err);
        res.status(500).send({ message: err.message || "Failed to fetch missed attendance." });
    }
};

/**
 * POST /api/attendance/manual-regularize
 * Accepts an array of attendance records to regularize/insert/update
 */
exports.regularizeAttendance = async (req, res) => {
    try {
        const { records } = req.body;

        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).send({ message: "No attendance records provided for regularization." });
        }

        const tz = await getAppTimezone();
        const complianceHours = await getComplianceHours();
        const results = [];
        const errors = [];

        for (const item of records) {
            try {
                const {
                    staff_id,
                    date,
                    check_in_time,
                    check_out_time,
                    reason = 'Work From Home',
                    notes = '',
                    existing_log_id = null
                } = item;

                if (!staff_id || !date || !check_in_time || !check_out_time) {
                    errors.push({ staff_id, date, message: "Missing required fields (staff_id, date, check_in_time, check_out_time)." });
                    continue;
                }

                // Verify staff exists and is active
                const staff = await User.findByPk(staff_id);
                if (!staff) {
                    errors.push({ staff_id, date, message: `Staff member ID ${staff_id} not found.` });
                    continue;
                }
                if (staff.active != 1) {
                    errors.push({ staff_id, date, message: `Staff member ${staff.firstname} ${staff.lastname} is inactive. Only active employees can be regularized.` });
                    continue;
                }

                // Verify employee is not on approved leave on this date
                const leaveOnDate = await LeaveRequest.findOne({
                    where: {
                        staff_id,
                        status: 'Approved',
                        start_date: { [Op.lte]: date },
                        end_date: { [Op.gte]: date }
                    }
                });
                if (leaveOnDate) {
                    errors.push({
                        staff_id,
                        date,
                        message: `${staff.firstname} ${staff.lastname} is on approved leave (${leaveOnDate.leave_type || 'Leave'}) on ${date}. Regularization skipped.`
                    });
                    continue;
                }

                // Construct full timestamp strings in application timezone
                // Format: "YYYY-MM-DD HH:mm:00"
                const inTimePart = check_in_time.length === 5 ? `${check_in_time}:00` : check_in_time;
                const outTimePart = check_out_time.length === 5 ? `${check_out_time}:00` : check_out_time;

                const checkInStr = `${date} ${inTimePart}`;
                const checkOutStr = `${date} ${outTimePart}`;

                const parsedInDate = timezoneUtil.parseTimeInTimezone(checkInStr, tz);
                const parsedOutDate = timezoneUtil.parseTimeInTimezone(checkOutStr, tz);

                if (isNaN(parsedInDate.getTime()) || isNaN(parsedOutDate.getTime())) {
                    errors.push({ staff_id, date, message: "Invalid time format." });
                    continue;
                }

                if (parsedOutDate.getTime() <= parsedInDate.getTime()) {
                    errors.push({ staff_id, date, message: "Check-out time must be after check-in time." });
                    continue;
                }

                let targetLog = null;

                // 1. Try finding by existing_log_id
                if (existing_log_id) {
                    targetLog = await AttendanceLog.findByPk(existing_log_id);
                }

                // 2. If not found, try finding existing open log for staff on that date
                if (!targetLog) {
                    targetLog = await AttendanceLog.findOne({
                        where: {
                            staff_id,
                            date,
                            check_out_time: null
                        },
                        order: [['check_in_time', 'DESC']]
                    });
                }

                // 3. Update or Create
                let isCreated = false;
                if (targetLog) {
                    await targetLog.update({
                        check_in_time: parsedInDate,
                        check_out_time: parsedOutDate,
                        phone_model: 'Manual Regularization (HR)'
                    });
                } else {
                    targetLog = await AttendanceLog.create({
                        staff_id,
                        date,
                        check_in_time: parsedInDate,
                        check_out_time: parsedOutDate,
                        phone_model: 'Manual Regularization (HR)',
                        ip_address: getClientIp(req)
                    });
                    isCreated = true;
                }

                // 4. Ensure Approval record is created or updated as 'approved'
                const [approval, appCreated] = await Approval.findOrCreate({
                    where: { attendance_log_id: targetLog.id },
                    defaults: {
                        attendance_log_id: targetLog.id,
                        manager_id: staff.approving_manager_id || req.userId,
                        status: 'approved',
                        comments: `HR Manual Attendance: ${reason}${notes ? ` - ${notes}` : ''}`
                    }
                });

                if (!appCreated && approval.status !== 'approved') {
                    await approval.update({
                        status: 'approved',
                        comments: `HR Manual Attendance: ${reason}${notes ? ` - ${notes}` : ''}`
                    });
                }

                // 5. Activity Log
                const actionDesc = `${isCreated ? 'Created' : 'Updated'} manual attendance for ${staff.firstname} ${staff.lastname} on ${date} (${check_in_time} to ${check_out_time}). Reason: ${reason}`;
                await logActivity({
                    admin_id: req.userId,
                    action: isCreated ? 'CREATE' : 'UPDATE',
                    entity: 'AttendanceLog',
                    entity_id: targetLog.id,
                    affected_user_id: staff_id,
                    description: actionDesc,
                    new_values: {
                        staff_id,
                        date,
                        check_in_time: inTimePart,
                        check_out_time: outTimePart,
                        reason,
                        notes
                    },
                    ip_address: getClientIp(req),
                    user_agent: getUserAgent(req)
                });

                results.push({
                    staff_id,
                    date,
                    log_id: targetLog.id,
                    status: 'success'
                });

            } catch (innerErr) {
                console.error("Error processing record for staff:", item?.staff_id, innerErr);
                errors.push({
                    staff_id: item?.staff_id,
                    date: item?.date,
                    message: innerErr.message || "Failed to save record"
                });
            }
        }

        res.status(200).send({
            success: true,
            total_processed: records.length,
            success_count: results.length,
            error_count: errors.length,
            results,
            errors,
            message: `Successfully regularized ${results.length} record(s).${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
        });

    } catch (err) {
        console.error("Error in regularizeAttendance:", err);
        res.status(500).send({ message: err.message || "Failed to regularize attendance." });
    }
};

/**
 * GET /api/attendance/manual-recent
 * Returns recently regularized attendance records
 */
exports.getRecentRegularizations = async (req, res) => {
    try {
        const tz = await getAppTimezone();
        const limit = parseInt(req.query.limit) || 20;

        const logs = await AttendanceLog.findAll({
            where: {
                phone_model: {
                    [Op.like]: '%Manual Regularization%'
                }
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    include: [
                        {
                            model: EmployeeProfile,
                            as: 'profile_info',
                            attributes: ['image_path']
                        }
                    ]
                },
                {
                    model: Approval,
                    as: 'approval'
                }
            ],
            order: [['updatedAt', 'DESC']],
            limit
        });

        const formatted = logs.map(log => {
            const plain = log.get({ plain: true });
            return {
                id: plain.id,
                staff_id: plain.staff_id,
                employee_name: plain.user ? `${plain.user.firstname || ''} ${plain.user.lastname || ''}`.trim() : 'Unknown',
                email: plain.user?.email,
                avatar: plain.user?.profile_info?.image_path,
                date: plain.date,
                check_in_time: formatTimeToHHMM(plain.check_in_time, tz),
                check_out_time: formatTimeToHHMM(plain.check_out_time, tz),
                status: plain.approval?.status || 'approved',
                comments: plain.approval?.comments || '',
                updatedAt: plain.updatedAt
            };
        });

        res.status(200).send({
            success: true,
            recent: formatted
        });

    } catch (err) {
        console.error("Error in getRecentRegularizations:", err);
        res.status(500).send({ message: err.message || "Failed to fetch recent regularizations." });
    }
};

/**
 * Comprehensive Test Suite for Event Overlap & Compliance Rules
 *
 * Verifies all rules for Leave, Time-Off, On-Duty, and Attendance:
 * 1. Leave:
 *    - Blocks if attendance recorded for date
 *    - Blocks if time-off applied for date
 *    - Blocks if on-duty applied for date
 * 2. Time-Off:
 *    - Blocked if leave applied for date
 *    - Blocked if on-duty is live
 *    - Blocked if on-duty exists for date
 *    - Blocked if time-off already exists for date
 *    - Added to attendance if within monthly limit
 *    - Deducted from attendance if monthly limit reached
 * 3. On-Duty:
 *    - Blocked if on-duty already live
 *    - Blocked on leave day
 *    - Auto-truncates in-progress time-off end-time to on-duty start time
 *    - Blocked if time-off exists on day and is not in progress
 *    - Compliance Scenario 1 (Between office hours): actual att = total - OD overlap, compliant = actual att + OD
 *    - Compliance Scenario 2 (Before office): compliant = OD + att
 *    - Compliance Scenario 3 (End of day): compliant = att + OD
 * 4. Attendance:
 *    - Blocked on leave day
 *    - Blocked when on-duty is live
 *    - Auto-truncates in-progress time-off end-time to check-in time
 */

const {
    checkLeaveConflict,
    checkTimeOffConflict,
    checkOnDutyStartConflict,
    checkAttendanceCheckInConflict,
    timeStringToMinutes,
    formatToHHMMSS
} = require('../utils/eventOverlap.util');

const { calculateMonthlyCompliance } = require('../utils/salaryCompliance.util');
const { getTestUserForRole } = require('./helpers/auth-helper');
const db = require('../models');

describe('Event Overlap and Conflict Rules', () => {
    let testStaffId;
    const testDate = '2026-11-10';

    beforeAll(async () => {
        const testUser = await getTestUserForRole('employee');
        testStaffId = testUser.staffid;
    });

    beforeEach(async () => {
        if (!testStaffId) return;
        // Clean up test data for testDate before each test
        await db.attendance_logs.destroy({ where: { staff_id: testStaffId, date: testDate } });
        await db.time_off_requests.destroy({ where: { staff_id: testStaffId, date: testDate } });
        await db.on_duty_logs.destroy({ where: { staff_id: testStaffId } });
        await db.leave_requests.destroy({ where: { staff_id: testStaffId } });
    });

    afterAll(async () => {
        if (testStaffId) {
            await db.attendance_logs.destroy({ where: { staff_id: testStaffId, date: testDate } });
            await db.time_off_requests.destroy({ where: { staff_id: testStaffId, date: testDate } });
            await db.on_duty_logs.destroy({ where: { staff_id: testStaffId } });
            await db.leave_requests.destroy({ where: { staff_id: testStaffId } });
        }
    });

    describe('1. Leave Rules', () => {
        test('Leave cannot be applied if attendance is already recorded on that date', async () => {
            await db.attendance_logs.create({
                staff_id: testStaffId,
                date: testDate,
                check_in_time: `${testDate} 09:30:00`
            });

            const result = await checkLeaveConflict(testStaffId, testDate, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('ATTENDANCE');
            expect(result.message).toContain('Attendance check-in has already been recorded');
        });

        test('Leave cannot be applied if time-off is already applied on that date', async () => {
            await db.time_off_requests.create({
                staff_id: testStaffId,
                date: testDate,
                start_time: '14:00:00',
                end_time: '16:00:00',
                reason: 'Doctor visit',
                status: 'Pending'
            });

            const result = await checkLeaveConflict(testStaffId, testDate, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('TIME_OFF');
            expect(result.message).toContain('Time-off has already been applied');
        });

        test('Leave cannot be applied if on-duty is already recorded on that date', async () => {
            await db.on_duty_logs.create({
                staff_id: testStaffId,
                client_name: 'Client Alpha',
                location: 'Site A',
                purpose: 'Inspection',
                start_time: new Date(`${testDate}T10:00:00Z`),
                status: 'Pending'
            });

            const result = await checkLeaveConflict(testStaffId, testDate, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('ON_DUTY');
            expect(result.message).toContain('On-duty has already been recorded');
        });

        test('Leave application succeeds when no conflicting events exist', async () => {
            const result = await checkLeaveConflict(testStaffId, testDate, testDate);
            expect(result.conflict).toBe(false);
        });
    });

    describe('2. Time-Off Rules', () => {
        test('Time-off cannot be applied if leave is applied for that date', async () => {
            await db.leave_requests.create({
                staff_id: testStaffId,
                start_date: testDate,
                end_date: testDate,
                leave_type: 'Casual Leave',
                reason: 'Family event',
                status: 'Pending'
            });

            const result = await checkTimeOffConflict(testStaffId, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('LEAVE');
            expect(result.message).toContain('Leave has already been applied for this day');
        });

        test('Time-off cannot be applied if on-duty is currently live', async () => {
            await db.on_duty_logs.create({
                staff_id: testStaffId,
                client_name: 'Live Client',
                location: 'Downtown',
                purpose: 'Meeting',
                start_time: new Date(),
                end_time: null,
                status: 'Pending'
            });

            const result = await checkTimeOffConflict(testStaffId, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('LIVE_ON_DUTY');
            expect(result.message).toContain('on-duty visit currently in progress');
        });

        test('Time-off cannot be applied if on-duty is recorded for that day', async () => {
            await db.on_duty_logs.create({
                staff_id: testStaffId,
                client_name: 'Past Client',
                location: 'Uptown',
                purpose: 'Audit',
                start_time: new Date(`${testDate}T09:30:00Z`),
                end_time: new Date(`${testDate}T11:30:00Z`),
                status: 'Approved'
            });

            const result = await checkTimeOffConflict(testStaffId, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('ON_DUTY');
            expect(result.message).toContain('On-duty has already been recorded for this day');
        });

        test('Time-off cannot be applied if an existing time-off is already on that date', async () => {
            await db.time_off_requests.create({
                staff_id: testStaffId,
                date: testDate,
                start_time: '10:00:00',
                end_time: '11:00:00',
                reason: 'Bank work',
                status: 'Pending'
            });

            const result = await checkTimeOffConflict(testStaffId, testDate);
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('TIME_OFF_EXISTS');
            expect(result.message).toContain('Only one time-off request is allowed per day');
        });

        test('Time-off application succeeds when no conflict exists', async () => {
            const result = await checkTimeOffConflict(testStaffId, testDate);
            expect(result.conflict).toBe(false);
        });
    });

    describe('3. On-Duty Rules', () => {
        test('On-duty cannot start if another on-duty is already live', async () => {
            await db.on_duty_logs.create({
                staff_id: testStaffId,
                client_name: 'Active Client',
                location: 'Site B',
                purpose: 'Service',
                start_time: new Date(),
                end_time: null,
                status: 'Pending'
            });

            const result = await checkOnDutyStartConflict(testStaffId, testDate, '11:00:00');
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('LIVE_ON_DUTY');
        });

        test('On-duty cannot start on a leave day', async () => {
            await db.leave_requests.create({
                staff_id: testStaffId,
                start_date: testDate,
                end_date: testDate,
                leave_type: 'Sick Leave',
                reason: 'Unwell',
                status: 'Pending'
            });

            const result = await checkOnDutyStartConflict(testStaffId, testDate, '10:00:00');
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('LEAVE');
            expect(result.message).toContain('Cannot start on-duty on a leave day');
        });

        test('Starting on-duty when time-off is in progress updates time-off end-time to on-duty start time', async () => {
            const timeOff = await db.time_off_requests.create({
                staff_id: testStaffId,
                date: testDate,
                start_time: '14:00:00',
                end_time: '16:00:00',
                reason: 'Appointment',
                status: 'Approved'
            });

            // On-duty starts at 15:15:00 (during 14:00 to 16:00 time-off)
            const result = await checkOnDutyStartConflict(testStaffId, testDate, '15:15:00');
            expect(result.conflict).toBe(false);
            expect(result.truncatedTimeOff).toBeDefined();

            // Refresh from database to verify persisted end_time
            const reloadedTimeOff = await db.time_off_requests.findByPk(timeOff.id);
            expect(reloadedTimeOff.end_time).toBe('15:15:00');
        });

        test('Starting on-duty is blocked if time-off on that day is NOT in progress', async () => {
            await db.time_off_requests.create({
                staff_id: testStaffId,
                date: testDate,
                start_time: '10:00:00',
                end_time: '11:00:00',
                reason: 'Early errand',
                status: 'Pending'
            });

            // Attempting to start on-duty at 14:00 (outside 10:00-11:00)
            const result = await checkOnDutyStartConflict(testStaffId, testDate, '14:00:00');
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('TIME_OFF_EXISTS');
            expect(result.message).toContain('time-off has already been applied for today');
        });
    });

    describe('4. Attendance Check-In Rules', () => {
        test('Attendance check-in is not allowed on a leave day', async () => {
            await db.leave_requests.create({
                staff_id: testStaffId,
                start_date: testDate,
                end_date: testDate,
                leave_type: 'Casual Leave',
                reason: 'Holiday',
                status: 'Approved'
            });

            const result = await checkAttendanceCheckInConflict(testStaffId, testDate, '09:30:00');
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('LEAVE');
            expect(result.message).toContain('Attendance check-in is not allowed on a leave day');
        });

        test('Attendance check-in is not allowed when on-duty is in progress', async () => {
            await db.on_duty_logs.create({
                staff_id: testStaffId,
                client_name: 'Client Live',
                location: 'Downtown',
                purpose: 'Emergency visit',
                start_time: new Date(),
                end_time: null,
                status: 'Pending'
            });

            const result = await checkAttendanceCheckInConflict(testStaffId, testDate, '10:00:00');
            expect(result.conflict).toBe(true);
            expect(result.type).toBe('LIVE_ON_DUTY');
            expect(result.message).toContain('Attendance check-in is not allowed when on-duty is in progress');
        });

        test('Attendance check-in when time-off is in progress updates time-off end-time to check-in time', async () => {
            const timeOff = await db.time_off_requests.create({
                staff_id: testStaffId,
                date: testDate,
                start_time: '09:30:00',
                end_time: '12:30:00',
                reason: 'Morning personal work',
                status: 'Approved'
            });

            // Employee reaches office early and checks in at 11:30:00
            const result = await checkAttendanceCheckInConflict(testStaffId, testDate, '11:30:00');
            expect(result.conflict).toBe(false);
            expect(result.truncatedTimeOff).toBeDefined();

            const reloadedTimeOff = await db.time_off_requests.findByPk(timeOff.id);
            expect(reloadedTimeOff.end_time).toBe('11:30:00');
        });
    });

    describe('5. Attendance & Compliance Calculation Scenarios', () => {
        const config = {
            complianceHours: 9,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2
        };

        test('On-Duty Scenario 1: During office hours - actual attendance = total attendance - OD overlap', () => {
            // Employee checked in at 09:30, checked out at 18:30 (total 9h = 540m)
            // On-duty during the day: 14:00 to 16:00 (2h = 120m)
            const records = {
                attendanceRecords: [{
                    date: '2026-11-02',
                    check_in_time: '2026-11-02 09:30:00',
                    check_out_time: '2026-11-02 18:30:00',
                    work_minutes: 540
                }],
                ondutyRecords: [{
                    date: '2026-11-02',
                    start_time: '2026-11-02 14:00:00',
                    end_time: '2026-11-02 16:00:00',
                    minutes: 120
                }],
                leaveDays: [],
                timeoffRecords: []
            };

            const result = calculateMonthlyCompliance(records, config);
            const day = result.daily_breakdown[0];

            expect(day.attendance_minutes).toBe(540);
            expect(day.onduty_attendance_overlap_minutes).toBe(120);
            expect(day.actual_attendance_minutes).toBe(420); // 540 - 120 = 420m (7h)
            expect(day.onduty_minutes).toBe(120); // 2h
            expect(day.effective_work_minutes).toBe(540); // 420 actual att + 120 OD = 540m (9h)
            expect(day.is_compliant).toBe(true);
        });

        test('On-Duty Scenario 2: Before office - close OD upon reaching office, then check-in', () => {
            // OD from 09:30 to 11:30 (2h = 120m), attendance from 11:30 to 18:30 (7h = 420m)
            const records = {
                attendanceRecords: [{
                    date: '2026-11-03',
                    check_in_time: '2026-11-03 11:30:00',
                    check_out_time: '2026-11-03 18:30:00',
                    work_minutes: 420
                }],
                ondutyRecords: [{
                    date: '2026-11-03',
                    start_time: '2026-11-03 09:30:00',
                    end_time: '2026-11-03 11:30:00',
                    minutes: 120
                }],
                leaveDays: [],
                timeoffRecords: []
            };

            const result = calculateMonthlyCompliance(records, config);
            const day = result.daily_breakdown[0];

            expect(day.onduty_attendance_overlap_minutes).toBe(0);
            expect(day.actual_attendance_minutes).toBe(420);
            expect(day.effective_work_minutes).toBe(540); // 420 + 120 = 540m (9h)
            expect(day.is_compliant).toBe(true);
        });

        test('On-Duty Scenario 3: End of day - checkout attendance, start OD, complete OD', () => {
            // Attendance 09:30 to 17:30 (8h = 480m), OD 17:30 to 19:30 (2h = 120m)
            const records = {
                attendanceRecords: [{
                    date: '2026-11-04',
                    check_in_time: '2026-11-04 09:30:00',
                    check_out_time: '2026-11-04 17:30:00',
                    work_minutes: 480
                }],
                ondutyRecords: [{
                    date: '2026-11-04',
                    start_time: '2026-11-04 17:30:00',
                    end_time: '2026-11-04 19:30:00',
                    minutes: 120
                }],
                leaveDays: [],
                timeoffRecords: []
            };

            const result = calculateMonthlyCompliance(records, config);
            const day = result.daily_breakdown[0];

            expect(day.onduty_attendance_overlap_minutes).toBe(0);
            expect(day.actual_attendance_minutes).toBe(480);
            expect(day.effective_work_minutes).toBe(600); // 480 + 120 = 600m (10h)
            expect(day.is_compliant).toBe(true);
        });

        test('Time-Off added to attendance hours when monthly limit is not reached', () => {
            // Quota: 2 hours (120m). Time-off: 1 hour (60m). Attendance: 8 hours (480m).
            const records = {
                attendanceRecords: [{ date: '2026-11-05', work_minutes: 480 }],
                timeoffRecords: [{ date: '2026-11-05', minutes: 60 }],
                leaveDays: [],
                ondutyRecords: []
            };

            const result = calculateMonthlyCompliance(records, config);
            const day = result.daily_breakdown[0];

            expect(day.timeoff_credited_minutes).toBe(60);
            expect(day.timeoff_excess_minutes).toBe(0);
            // Added: 480 + 60 = 540m (9h) => Compliant!
            expect(day.effective_work_minutes).toBe(540);
            expect(day.is_compliant).toBe(true);
        });

        test('Time-Off reduced from attendance hours when monthly limit is reached already', () => {
            const zeroQuotaConfig = { complianceHours: 9, allowedLeavePerMonth: 1, allowedTimeOffPerMonth: 0 };
            // Quota: 0 hours. Time-off: 1 hour (60m). Attendance: 8 hours (480m).
            const records = {
                attendanceRecords: [{ date: '2026-11-06', work_minutes: 480 }],
                timeoffRecords: [{ date: '2026-11-06', minutes: 60 }],
                leaveDays: [],
                ondutyRecords: []
            };

            const result = calculateMonthlyCompliance(records, zeroQuotaConfig);
            const day = result.daily_breakdown[0];

            expect(day.timeoff_credited_minutes).toBe(0);
            expect(day.timeoff_excess_minutes).toBe(60);
            // Reduced: 480 - 60 = 420m (7h) => Non-compliant!
            expect(day.effective_work_minutes).toBe(420);
            expect(day.is_compliant).toBe(false);
        });
    });
});

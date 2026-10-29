const { calculateMonthlyCompliance, formatDuration } = require('../utils/salaryCompliance.util');

describe('salaryCompliance.util - calculateMonthlyCompliance', () => {
    test('formatDuration formats minutes accurately', () => {
        expect(formatDuration(0)).toBe('0m');
        expect(formatDuration(30)).toBe('30m');
        expect(formatDuration(60)).toBe('1h');
        expect(formatDuration(90)).toBe('1h 30m');
        expect(formatDuration(540)).toBe('9h');
    });

    test("User's exact specification scenario", () => {
        // Allowed leave = 1 day, Allowed time-off = 2 hours, Target = 9 hours
        const config = {
            complianceHours: 9,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2
        };

        const employeeRecords = {
            attendanceRecords: [
                { date: '2026-09-01', work_minutes: 5 * 60 },
                { date: '2026-09-02', work_minutes: 7 * 60 }
            ],
            ondutyRecords: [
                { date: '2026-09-01', minutes: 3 * 60 }
            ],
            timeoffRecords: [
                { date: '2026-09-01', minutes: 1 * 60 },
                { date: '2026-09-02', minutes: 2 * 60 }
            ],
            leaveDays: [
                { date: '2026-09-03', days: 1.0, leave_type: 'Casual Leave' },
                { date: '2026-09-04', days: 1.0, leave_type: 'Casual Leave' }
            ]
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);

        // Day 1: 5h att + 3h OD + 1h time-off = 9h >= 9h => Compliant (1 day)
        // Day 2: 7h att + 1h time-off (1h remaining in 2h pool) - 1h excess deducted (limit reached) = 7h < 9h => Non-Compliant (0 days)
        // Day 3: Leave 1d (1d remaining in 1d pool) => Compliant (1 day)
        // Day 4: Leave 1d (0d remaining in pool) => Non-Compliant (0 days)
        // Total Compliant Days = 2 days!

        expect(result.compliant_days).toBe(2);
        expect(result.non_compliant_days).toBe(2);

        expect(result.daily_breakdown).toHaveLength(4);

        // Day 1 verification
        const d1 = result.daily_breakdown.find(d => d.date === '2026-09-01');
        expect(d1.is_compliant).toBe(true);
        expect(d1.compliant_day_value).toBe(1);
        expect(d1.effective_work_minutes).toBe(9 * 60);
        expect(d1.timeoff_credited_minutes).toBe(60);
        expect(d1.timeoff_excess_minutes).toBe(0);

        // Day 2 verification
        const d2 = result.daily_breakdown.find(d => d.date === '2026-09-02');
        expect(d2.is_compliant).toBe(false);
        expect(d2.compliant_day_value).toBe(0);
        expect(d2.effective_work_minutes).toBe(7 * 60); // 7h att + 1h credited - 1h excess deducted = 7h!
        expect(d2.timeoff_credited_minutes).toBe(60); // only 1h remaining from 2h pool!
        expect(d2.timeoff_excess_minutes).toBe(60); // 1h excess deducted

        // Day 3 verification
        const d3 = result.daily_breakdown.find(d => d.date === '2026-09-03');
        expect(d3.is_compliant).toBe(true);
        expect(d3.compliant_day_value).toBe(1);
        expect(d3.leave_credited).toBe(1);
        expect(d3.leave_excess).toBe(0);

        // Day 4 verification
        const d4 = result.daily_breakdown.find(d => d.date === '2026-09-04');
        expect(d4.is_compliant).toBe(false);
        expect(d4.compliant_day_value).toBe(0);
        expect(d4.leave_credited).toBe(0);
        expect(d4.leave_excess).toBe(1);

        // Quota summary verification
        expect(result.quota_summary.allowed_leave_days).toBe(1);
        expect(result.quota_summary.used_leave_days).toBe(2);
        expect(result.quota_summary.credited_leave_days).toBe(1);
        expect(result.quota_summary.remaining_leave_days).toBe(0);

        expect(result.quota_summary.allowed_timeoff_minutes).toBe(120);
        expect(result.quota_summary.used_timeoff_minutes).toBe(180);
        expect(result.quota_summary.credited_timeoff_minutes).toBe(120);
        expect(result.quota_summary.remaining_timeoff_minutes).toBe(0);
    });

    test('Half-day leave and half-day work combinations', () => {
        const config = {
            complianceHours: 8,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 0
        };

        const employeeRecords = {
            attendanceRecords: [
                { date: '2026-09-10', work_minutes: 4 * 60 }
            ],
            leaveDays: [
                { date: '2026-09-10', days: 0.5, leave_type: 'Sick Leave' }
            ]
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        expect(result.compliant_days).toBe(1); // 0.5 leave credited + 4h work (>= 4h target) = 1 day
        expect(result.non_compliant_days).toBe(0);
    });

    test('Company holidays are included in monthly breakdown and marked as compliant (paid)', () => {
        const config = {
            complianceHours: 9,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2,
            holidays: [
                { holiday_date: '2026-10-02', holiday_name: 'Gandhi Jayanthi' },
                { holiday_date: '2026-10-20', holiday_name: 'VIJAYADHASAMI' }
            ]
        };

        const employeeRecords = {
            attendanceRecords: [
                { date: '2026-10-01', work_minutes: 9 * 60 } // Compliant working day
            ],
            leaveDays: [],
            timeoffRecords: [],
            ondutyRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);

        // 1 worked day + 2 holiday days = 3 compliant days
        expect(result.compliant_days).toBe(3);
        expect(result.non_compliant_days).toBe(0);
        expect(result.holidays_count).toBe(2);

        // Verify holiday breakdown rows
        const h1 = result.daily_breakdown.find(d => d.date === '2026-10-02');
        expect(h1).toBeDefined();
        expect(h1.type).toBe('Holiday');
        expect(h1.is_compliant).toBe(true);
        expect(h1.compliant_day_value).toBe(1);
        expect(h1.holiday_name).toBe('Gandhi Jayanthi');
        expect(h1.remarks).toContain('Gandhi Jayanthi');

        const h2 = result.daily_breakdown.find(d => d.date === '2026-10-20');
        expect(h2).toBeDefined();
        expect(h2.type).toBe('Holiday');
        expect(h2.is_compliant).toBe(true);
        expect(h2.compliant_day_value).toBe(1);
        expect(h2.holiday_name).toBe('VIJAYADHASAMI');
    });

    test('Effective work time properly calculates as attendance + credited time-off + on-duty', () => {
        const config = {
            complianceHours: 9, // 540 minutes
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2 // 120 minutes
        };

        // Scenario: 8h 55m Attendance (535 mins) + 2h Time-Off (120 mins) = 10h 55m (655 mins)
        const employeeRecords = {
            attendanceRecords: [
                {
                    date: '2026-10-13',
                    check_in_time_str: '09:36',
                    check_out_time_str: '18:32',
                    work_minutes: 535
                }
            ],
            leaveDays: [],
            timeoffRecords: [
                {
                    date: '2026-10-13',
                    start_time: '14:00:00',
                    end_time: '16:00:00',
                    minutes: 120,
                    reason: 'Personal'
                }
            ],
            ondutyRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);

        // Verification:
        // attendance_minutes: 535 (8h 55m)
        // timeoff_credited_minutes: 120 (2h)
        // effective_work_minutes: 535 + 120 = 655 (10h 55m)
        // 655 >= 540 => Compliant
        const day = result.daily_breakdown.find(d => d.date === '2026-10-13');
        expect(day).toBeDefined();
        expect(day.attendance_minutes).toBe(535);
        expect(day.timeoff_credited_minutes).toBe(120);
        expect(day.effective_work_minutes).toBe(655);
        expect(day.remarks).toBe('8h 55m Att + 2h Time-Off = 10h 55m >= 9h target');
        expect(day.is_compliant).toBe(true);
        expect(result.compliant_days).toBe(1);
    });

    test('Sundays are marked as Compliant weekly off days', () => {
        const config = {
            complianceHours: 9,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2
        };

        // 2026-10-04 is a Sunday
        const employeeRecords = {
            attendanceRecords: [
                { date: '2026-10-04', work_minutes: 120 } // Worked 2 hours on Sunday
            ],
            leaveDays: [],
            timeoffRecords: [],
            ondutyRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        const sun = result.daily_breakdown.find(d => d.date === '2026-10-04');
        expect(sun).toBeDefined();
        expect(sun.is_compliant).toBe(true);
        expect(sun.compliant_day_value).toBe(1);
        expect(sun.remarks).toContain('Sunday Weekly Off (Compliant)');
        expect(result.compliant_days).toBe(1);
    });

    it('calculates compliance correctly for part-time employees with configured part-time hours', () => {
        const config = {
            complianceHoursFullTime: 9,
            complianceHoursPartTime: 4.5,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2
        };

        const employeeRecords = {
            employment_type: 'Part-time',
            attendanceRecords: [
                { date: '2026-10-05', work_minutes: 270 }, // 4.5h (Monday) - exact match
                { date: '2026-10-06', work_minutes: 180 }, // 3h attendance (Tuesday)
                { date: '2026-10-07', work_minutes: 240 }  // 4h attendance (Wednesday - below 4.5h)
            ],
            leaveDays: [],
            timeoffRecords: [
                { date: '2026-10-06', minutes: 90 } // 1.5h time-off on Tuesday => 3h + 1.5h = 4.5h
            ],
            ondutyRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        expect(result.employment_type).toBe('Part-time');
        expect(result.compliance_hours).toBe(4.5);

        const day1 = result.daily_breakdown.find(d => d.date === '2026-10-05');
        expect(day1.is_compliant).toBe(true);
        expect(day1.compliant_day_value).toBe(1);
        expect(day1.target_hours).toBe(4.5);

        const day2 = result.daily_breakdown.find(d => d.date === '2026-10-06');
        expect(day2.is_compliant).toBe(true);
        expect(day2.compliant_day_value).toBe(1);
        expect(day2.effective_work_minutes).toBe(270);

        const day3 = result.daily_breakdown.find(d => d.date === '2026-10-07');
        expect(day3.is_compliant).toBe(false);
        expect(day3.compliant_day_value).toBe(0);

        expect(result.compliant_days).toBe(2);
        expect(result.non_compliant_days).toBe(1);
    });

    it('differentiates full-time and part-time for the same 5-hour work duration', () => {
        const config = {
            complianceHoursFullTime: 9,
            complianceHoursPartTime: 5,
            allowedLeavePerMonth: 1,
            allowedTimeOffPerMonth: 2
        };

        // 5 hours = 300 minutes
        const ftRecords = {
            employment_type: 'Full-time',
            attendanceRecords: [{ date: '2026-10-05', work_minutes: 300 }],
            leaveDays: [],
            timeoffRecords: [],
            ondutyRecords: []
        };

        const ptRecords = {
            employment_type: 'Part-time',
            attendanceRecords: [{ date: '2026-10-05', work_minutes: 300 }],
            leaveDays: [],
            timeoffRecords: [],
            ondutyRecords: []
        };

        const ftResult = calculateMonthlyCompliance(ftRecords, config);
        const ptResult = calculateMonthlyCompliance(ptRecords, config);

        expect(ftResult.compliant_days).toBe(0);
        expect(ftResult.daily_breakdown[0].is_compliant).toBe(false);

        expect(ptResult.compliant_days).toBe(1);
        expect(ptResult.daily_breakdown[0].is_compliant).toBe(true);
    });

    test('On-Duty Scenario 1: Between office hours - attendance out of OD (total - OD = actual attendance)', () => {
        const config = { complianceHours: 9, allowedLeavePerMonth: 1, allowedTimeOffPerMonth: 2 };
        // Employee checked in 09:30, went on OD 14:00 - 16:00 (2h), checkout 18:30 (total 9h = 540m)
        const employeeRecords = {
            attendanceRecords: [{
                date: '2026-10-12',
                check_in_time: '2026-10-12 09:30:00',
                check_out_time: '2026-10-12 18:30:00',
                work_minutes: 540
            }],
            ondutyRecords: [{
                date: '2026-10-12',
                start_time: '2026-10-12 14:00:00',
                end_time: '2026-10-12 16:00:00',
                minutes: 120
            }],
            leaveDays: [],
            timeoffRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        const day = result.daily_breakdown[0];

        expect(day.attendance_minutes).toBe(540);
        expect(day.onduty_attendance_overlap_minutes).toBe(120);
        expect(day.actual_attendance_minutes).toBe(420); // 7 hours
        expect(day.onduty_minutes).toBe(120); // 2 hours
        expect(day.effective_work_minutes).toBe(540); // 7h actual + 2h OD = 9h compliant
        expect(day.is_compliant).toBe(true);
    });

    test('On-Duty Scenario 2: Before coming to office - OD in morning, close OD upon arrival, check in', () => {
        const config = { complianceHours: 9, allowedLeavePerMonth: 1, allowedTimeOffPerMonth: 2 };
        // OD 09:30 to 11:30 (2h = 120m), attendance 11:30 to 18:30 (7h = 420m)
        const employeeRecords = {
            attendanceRecords: [{
                date: '2026-10-13',
                check_in_time: '2026-10-13 11:30:00',
                check_out_time: '2026-10-13 18:30:00',
                work_minutes: 420
            }],
            ondutyRecords: [{
                date: '2026-10-13',
                start_time: '2026-10-13 09:30:00',
                end_time: '2026-10-13 11:30:00',
                minutes: 120
            }],
            leaveDays: [],
            timeoffRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        const day = result.daily_breakdown[0];

        expect(day.onduty_attendance_overlap_minutes).toBe(0);
        expect(day.actual_attendance_minutes).toBe(420);
        expect(day.effective_work_minutes).toBe(540); // 420 + 120 = 540 (9h)
        expect(day.is_compliant).toBe(true);
    });

    test('On-Duty Scenario 3: End of the day - checkout for attendance, start OD, complete OD', () => {
        const config = { complianceHours: 9, allowedLeavePerMonth: 1, allowedTimeOffPerMonth: 2 };
        // Attendance 09:30 to 17:30 (8h = 480m), OD 17:30 to 19:30 (2h = 120m)
        const employeeRecords = {
            attendanceRecords: [{
                date: '2026-10-14',
                check_in_time: '2026-10-14 09:30:00',
                check_out_time: '2026-10-14 17:30:00',
                work_minutes: 480
            }],
            ondutyRecords: [{
                date: '2026-10-14',
                start_time: '2026-10-14 17:30:00',
                end_time: '2026-10-14 19:30:00',
                minutes: 120
            }],
            leaveDays: [],
            timeoffRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        const day = result.daily_breakdown[0];

        expect(day.onduty_attendance_overlap_minutes).toBe(0);
        expect(day.actual_attendance_minutes).toBe(480);
        expect(day.effective_work_minutes).toBe(600); // 480 + 120 = 600 (10h)
        expect(day.is_compliant).toBe(true);
    });

    test('Time-Off limit reached already: time-off hours are reduced from attendance hours', () => {
        const config = { complianceHours: 9, allowedLeavePerMonth: 1, allowedTimeOffPerMonth: 0 }; // 0 quota
        // Attendance: 8 hours (480m). Time-off: 1 hour (60m). Quota is 0, so 60m is excess.
        const employeeRecords = {
            attendanceRecords: [{
                date: '2026-10-15',
                work_minutes: 480
            }],
            timeoffRecords: [{
                date: '2026-10-15',
                minutes: 60
            }],
            leaveDays: [],
            ondutyRecords: []
        };

        const result = calculateMonthlyCompliance(employeeRecords, config);
        const day = result.daily_breakdown[0];

        expect(day.timeoff_credited_minutes).toBe(0);
        expect(day.timeoff_excess_minutes).toBe(60);
        // Reduced from attendance: 480 - 60 = 420 mins (7 hours)
        expect(day.effective_work_minutes).toBe(420);
        expect(day.is_compliant).toBe(false);
    });
});




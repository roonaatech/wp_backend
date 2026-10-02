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
        // Day 2: 7h att + 1h time-off (1h remaining in 2h pool) = 8h < 9h => Non-Compliant (0 days)
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
        expect(d2.effective_work_minutes).toBe(8 * 60);
        expect(d2.timeoff_credited_minutes).toBe(60); // only 1h remaining from 2h pool!
        expect(d2.timeoff_excess_minutes).toBe(60); // 1h excess uncredited

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
});


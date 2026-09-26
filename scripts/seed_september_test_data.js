const db = require("../models");
const { Op } = require("sequelize");

async function seedSeptemberData() {
    try {
        await db.sequelize.authenticate();
        console.log("Connected to MySQL database.");

        const users = await db.user.findAll({
            where: { active: 1 },
            attributes: ["staffid", "firstname", "lastname", "email", "role", "approving_manager_id"]
        });

        console.log(`Found ${users.length} active users.`);
        if (users.length === 0) {
            console.error("No active users found.");
            process.exit(1);
        }

        const validStaffIds = new Set(users.map(u => u.staffid));

        // Clean leave types to only use realistic names
        const standardLeaveTypes = ["Casual Leave", "Earned Leave", "Loss of Pay", "Maternity Leave", "Paternity Leave"];
        const leaveTypesList = await db.leave_types.findAll({ where: { status: true } });
        let availableLeaveTypes = leaveTypesList
            .map(lt => lt.name)
            .filter(name => standardLeaveTypes.includes(name));

        if (availableLeaveTypes.length === 0) {
            availableLeaveTypes = ["Casual Leave", "Earned Leave", "Loss of Pay"];
        }

        console.log("Using Leave Types:", availableLeaveTypes);

        // Fallback manager ID: user 1 (Sakthivel Deivasigamani)
        const defaultManagerId = validStaffIds.has(1) ? 1 : users[0].staffid;

        const getValidManagerId = (user) => {
            if (user.approving_manager_id && validStaffIds.has(user.approving_manager_id)) {
                return user.approving_manager_id;
            }
            return defaultManagerId;
        };

        // Working days in September 2026 (Mon - Fri)
        const workingDays = [
            "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
            "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11",
            "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18",
            "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25",
            "2026-09-28", "2026-09-29", "2026-09-30"
        ];

        // Device models for attendance
        const deviceModels = [
            "Samsung Galaxy S23",
            "iPhone 15 Pro",
            "Google Pixel 8",
            "OnePlus 11",
            "Front Desk QR Terminal",
            "Xiaomi 13 Pro",
            "Vivo X90",
            "Samsung Galaxy A54"
        ];

        // Realistic reasons
        const leaveReasons = [
            "Family function in hometown",
            "Personal work and banking",
            "Health checkup and recovery",
            "Attending wedding ceremony",
            "Urgent domestic maintenance",
            "Child school annual function",
            "Travel to home town",
            "Minor fever and doctor advised rest"
        ];

        const timeOffReasons = [
            "Dentist consultation appointment",
            "Bank locker documentation visit",
            "Children school parent-teacher meeting",
            "Vehicle service and inspection",
            "Passport verification appointment",
            "Emergency medical prescription pickup",
            "Home utility service technician visit"
        ];

        // Clear existing September records in leave_requests and time_off_requests to prevent duplicates
        await db.leave_requests.destroy({
            where: { start_date: { [Op.between]: ["2026-09-01", "2026-09-30"] } }
        });
        await db.time_off_requests.destroy({
            where: { date: { [Op.between]: ["2026-09-01", "2026-09-30"] } }
        });

        // Track employee leave dates so we don't insert attendance on full-day leave
        const staffLeaveDates = new Map(); // staffid -> Set of 'YYYY-MM-DD'

        // 1. Seed Leave Requests
        console.log("\n--- Seeding Leave Requests ---");
        const leaveRequestsData = [];

        // Pick distinct employees for leaves
        const targetStaffList = users.filter(u => u.staffid !== 1); // employees & managers
        
        targetStaffList.forEach((user, index) => {
            const staffId = user.staffid;
            const staffLeaves = new Set();
            const managerId = getValidManagerId(user);

            // Give each user 1-2 leave events in September
            if (index % 2 === 0) {
                // 1-day leave
                const dayIndex = (index * 3) % workingDays.length;
                const leaveDate = workingDays[dayIndex];
                staffLeaves.add(leaveDate);

                const leaveType = availableLeaveTypes[index % availableLeaveTypes.length];
                const status = (index === 4) ? "Pending" : (index === 8) ? "Rejected" : "Approved";
                const isHalfDay = (index % 6 === 0);

                leaveRequestsData.push({
                    staff_id: staffId,
                    leave_type: leaveType,
                    start_date: leaveDate,
                    end_date: leaveDate,
                    is_half_day: isHalfDay,
                    reason: leaveReasons[index % leaveReasons.length],
                    status: status,
                    manager_id: managerId,
                    rejection_reason: status === "Rejected" ? "High project priority scheduled during this period." : null,
                    createdAt: new Date(`${leaveDate}T04:00:00.000Z`),
                    updatedAt: new Date(`${leaveDate}T05:30:00.000Z`)
                });
            }

            if (index % 5 === 0) {
                // Multi-day leave (2 days)
                const startDayIndex = ((index * 2) + 1) % (workingDays.length - 1);
                const startDate = workingDays[startDayIndex];
                const endDate = workingDays[startDayIndex + 1];
                staffLeaves.add(startDate);
                staffLeaves.add(endDate);

                leaveRequestsData.push({
                    staff_id: staffId,
                    leave_type: "Casual Leave",
                    start_date: startDate,
                    end_date: endDate,
                    is_half_day: false,
                    reason: "Family vacation and travel out of station",
                    status: "Approved",
                    manager_id: managerId,
                    rejection_reason: null,
                    createdAt: new Date(`${startDate}T03:30:00.000Z`),
                    updatedAt: new Date(`${startDate}T05:00:00.000Z`)
                });
            }

            staffLeaveDates.set(staffId, staffLeaves);
        });

        // Insert leaves into DB
        for (const leaveData of leaveRequestsData) {
            await db.leave_requests.create(leaveData);
        }
        console.log(`Created ${leaveRequestsData.length} leave requests.`);

        // 2. Seed Time-Off Requests
        console.log("\n--- Seeding Time-Off Requests ---");
        const timeOffRequestsData = [];

        const timeSlots = [
            { start: "09:30:00", end: "11:00:00" }, // 1.5h
            { start: "10:00:00", end: "11:30:00" }, // 1.5h
            { start: "11:00:00", end: "12:30:00" }, // 1.5h
            { start: "14:00:00", end: "15:30:00" }, // 1.5h
            { start: "14:30:00", end: "16:00:00" }, // 1.5h
            { start: "15:00:00", end: "17:00:00" }  // 2h
        ];

        targetStaffList.forEach((user, index) => {
            const staffId = user.staffid;
            const managerId = getValidManagerId(user);

            // 1-2 time-off requests per user on days they are not on full leave
            const dayIndex = (index * 4 + 2) % workingDays.length;
            const timeOffDate = workingDays[dayIndex];
            const slot = timeSlots[index % timeSlots.length];
            const status = (index === 6) ? "Pending" : (index === 12) ? "Rejected" : "Approved";

            timeOffRequestsData.push({
                staff_id: staffId,
                date: timeOffDate,
                start_time: slot.start,
                end_time: slot.end,
                reason: timeOffReasons[index % timeOffReasons.length],
                status: status,
                manager_id: managerId,
                rejection_reason: status === "Rejected" ? "Core team standup scheduled during this slot." : null,
                createdAt: new Date(`${timeOffDate}T03:00:00.000Z`),
                updatedAt: new Date(`${timeOffDate}T04:30:00.000Z`)
            });

            // Extra time-off for some employees
            if (index % 3 === 0) {
                const dayIndex2 = (index * 5 + 7) % workingDays.length;
                const timeOffDate2 = workingDays[dayIndex2];
                const slot2 = timeSlots[(index + 3) % timeSlots.length];

                timeOffRequestsData.push({
                    staff_id: staffId,
                    date: timeOffDate2,
                    start_time: slot2.start,
                    end_time: slot2.end,
                    reason: timeOffReasons[(index + 3) % timeOffReasons.length],
                    status: "Approved",
                    manager_id: managerId,
                    rejection_reason: null,
                    createdAt: new Date(`${timeOffDate2}T03:15:00.000Z`),
                    updatedAt: new Date(`${timeOffDate2}T04:45:00.000Z`)
                });
            }
        });

        for (const toData of timeOffRequestsData) {
            await db.time_off_requests.create(toData);
        }
        console.log(`Created ${timeOffRequestsData.length} time-off requests.`);

        // 3. Seed Attendance Logs
        console.log("\n--- Seeding Attendance Logs ---");
        // Helper to convert IST string to UTC Date
        // e.g. date: '2026-09-08', time: '09:15:00' -> UTC Date is 03:45:00
        const makeUtcDate = (dateStr, timeStr) => {
            const [y, m, d] = dateStr.split("-").map(Number);
            const [hh, mm, ss] = timeStr.split(":").map(Number);
            // IST is UTC + 5:30. Subtract 5 hours 30 mins
            let totalMins = (hh * 60 + mm) - (5 * 60 + 30);
            let dayOffset = 0;
            if (totalMins < 0) {
                totalMins += 24 * 60;
                dayOffset = -1;
            }
            const utcHours = Math.floor(totalMins / 60);
            const utcMins = totalMins % 60;
            
            const dateObj = new Date(Date.UTC(y, m - 1, d + dayOffset, utcHours, utcMins, ss || 0));
            return dateObj;
        };

        let attendanceCreated = 0;
        let attendanceUpdated = 0;

        // Active check-in staff for today (Sep 25)
        const activeTodayStaffIds = new Set([
            users[1]?.staffid,
            users[3]?.staffid,
            users[6]?.staffid,
            users[10]?.staffid,
            users[15]?.staffid
        ].filter(Boolean));

        for (const user of users) {
            const staffId = user.staffid;
            const userLeaveSet = staffLeaveDates.get(staffId) || new Set();

            for (let dayIdx = 0; dayIdx < workingDays.length; dayIdx++) {
                const dateStr = workingDays[dayIdx];

                // Skip full-day approved leaves
                if (userLeaveSet.has(dateStr)) {
                    continue;
                }

                // Check if user already has an attendance log on this day
                const existingLog = await db.attendance_logs.findOne({
                    where: { staff_id: staffId, date: dateStr }
                });

                const device = deviceModels[(staffId + dayIdx) % deviceModels.length];
                const ip = `192.168.1.${10 + ((staffId + dayIdx * 7) % 200)}`;

                // Is today Sep 25 and active check-in?
                const isTodayActive = (dateStr === "2026-09-25" && activeTodayStaffIds.has(staffId));

                // Shift times
                // Random variation per staff / day
                const checkInMins = 5 + ((staffId * 3 + dayIdx * 7) % 35); // 09:05 to 09:40
                const inTimeStr = `09:${String(checkInMins).padStart(2, "0")}:00`;
                const checkInUtc = makeUtcDate(dateStr, inTimeStr);

                let checkOutUtc = null;
                if (!isTodayActive) {
                    // Decide compliance: ~85% compliant (8.5h to 9.5h), ~15% non-compliant (3.5h to 5h)
                    const isShortDay = ((staffId + dayIdx) % 8 === 0);
                    if (isShortDay) {
                        // Non-compliant early departure / half day (e.g. 13:30 to 14:15)
                        const shortMins = ((staffId + dayIdx) % 45);
                        const outTimeStr = `13:${String(30 + Math.floor(shortMins / 2)).padStart(2, "0")}:00`;
                        checkOutUtc = makeUtcDate(dateStr, outTimeStr);
                    } else {
                        // Compliant normal shift: 18:05 to 18:45
                        const outMins = 5 + ((staffId * 5 + dayIdx * 3) % 40);
                        const outTimeStr = `18:${String(outMins).padStart(2, "0")}:00`;
                        checkOutUtc = makeUtcDate(dateStr, outTimeStr);
                    }
                }

                if (existingLog) {
                    // Update existing log if it had trivial punch duration (< 10 mins)
                    const existingDiffMs = existingLog.check_out_time && existingLog.check_in_time 
                        ? (new Date(existingLog.check_out_time).getTime() - new Date(existingLog.check_in_time).getTime()) 
                        : 0;

                    if (existingDiffMs < 10 * 60 * 1000) {
                        existingLog.check_in_time = checkInUtc;
                        existingLog.check_out_time = checkOutUtc;
                        existingLog.phone_model = device;
                        existingLog.ip_address = ip;
                        existingLog.latitude = 11.016844;
                        existingLog.longitude = 76.955832;
                        await existingLog.save();
                        attendanceUpdated++;
                    }
                } else {
                    await db.attendance_logs.create({
                        staff_id: staffId,
                        date: dateStr,
                        check_in_time: checkInUtc,
                        check_out_time: checkOutUtc,
                        phone_model: device,
                        ip_address: ip,
                        latitude: 11.016844,
                        longitude: 76.955832
                    });
                    attendanceCreated++;
                }
            }
        }

        console.log(`Created ${attendanceCreated} new attendance logs.`);
        console.log(`Updated ${attendanceUpdated} existing attendance logs.`);

        // Final verification counts
        const totalSeptAttendance = await db.attendance_logs.count({
            where: { date: { [Op.between]: ["2026-09-01", "2026-09-30"] } }
        });
        const totalSeptLeaves = await db.leave_requests.count({
            where: { start_date: { [Op.between]: ["2026-09-01", "2026-09-30"] } }
        });
        const totalSeptTimeOff = await db.time_off_requests.count({
            where: { date: { [Op.between]: ["2026-09-01", "2026-09-30"] } }
        });

        console.log("\n=================================");
        console.log("SEPTEMBER 2026 DATA SEED COMPLETE");
        console.log(`Total Attendance Records: ${totalSeptAttendance}`);
        console.log(`Total Leave Requests:     ${totalSeptLeaves}`);
        console.log(`Total Time-Off Requests:  ${totalSeptTimeOff}`);
        console.log("=================================");

        process.exit(0);
    } catch (err) {
        console.error("Seeding failed with error:", err);
        process.exit(1);
    }
}

seedSeptemberData();

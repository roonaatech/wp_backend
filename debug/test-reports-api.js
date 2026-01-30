const db = require("../models");
const axios = require("axios");

async function testReportsAPI() {
    try {
        console.log("Connecting to DB...");
        await db.sequelize.authenticate();
        console.log("✓ Connection established\n");

        const Staff = db.user;
        const Role = db.roles;

        // Get HR user
        const hrUser = await Staff.findOne({
            where: { firstname: 'Ramkumar', lastname: 'Nagarajan' },
            include: [{
                model: Role,
                as: 'role_info'
            }]
        });

        if (!hrUser) {
            console.log("❌ HR user Ramkumar Nagarajan not found!");
            return;
        }

        console.log(`👤 Testing as HR User: ${hrUser.firstname} ${hrUser.lastname} (ID: ${hrUser.staffid})`);
        console.log(`   Role ID: ${hrUser.role}`);
        console.log(`   Role Name: ${hrUser.role_info?.name}`);
        console.log(`   can_view_reports: ${hrUser.role_info?.can_view_reports}\n`);

        // Simulate the getAttendanceReports function
        const { Op } = require("sequelize");
        const LeaveRequest = db.leave_requests;
        const OnDutyLog = db.on_duty_logs;

        const userRole = hrUser.role_info;
        const canViewAllReports = userRole && userRole.can_view_reports === 'all';

        console.log(`✓ canViewAllReports: ${canViewAllReports}`);

        // If user can only view subordinates, get their reportees
        let reporteeIds = [];
        if (!canViewAllReports) {
            const reportees = await Staff.findAll({
                attributes: ['staffid'],
                where: {
                    approving_manager_id: hrUser.staffid
                },
                raw: true
            });
            reporteeIds = reportees.map(r => r.staffid);
            console.log(`❌ User can only view subordinates. Reportees:`, reporteeIds);
        } else {
            console.log(`✓ User can view ALL reports (no filtering by subordinates)`);
        }

        // Build where clause for leaves
        let leaveWhere = {};
        if (!canViewAllReports) {
            leaveWhere.staff_id = { [Op.in]: reporteeIds };
        }

        // Get leave requests count
        const leaveCount = await LeaveRequest.count({ where: leaveWhere });
        console.log(`\n📊 Leave Requests Found: ${leaveCount}`);

        // Get on-duty logs count
        let onDutyWhere = {};
        if (!canViewAllReports) {
            onDutyWhere.staff_id = { [Op.in]: reporteeIds };
        }
        const onDutyCount = await OnDutyLog.count({ where: onDutyWhere });
        console.log(`   On-Duty Logs Found: ${onDutyCount}`);

        console.log("\n✅ API Simulation complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

testReportsAPI();

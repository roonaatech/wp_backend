const db = require("../models");

(async () => {
    try {
        // Find a staff member
        const staff = await db.user.findOne();
        if (!staff) {
            console.log('No staff found');
            process.exit(1);
        }

        console.log('Found staff:', staff.staffid, staff.firstname);

        // Create an on-duty log
        const onDutyLog = await db.on_duty_logs.create({
            staff_id: staff.staffid,
            client_name: 'Test Client',
            location: 'Test Location',
            purpose: 'Test Purpose',
            start_lat: '10.0',
            start_long: '20.0',
            start_time: new Date(),
            end_time: null,  // This makes it "active"
            status: 'Pending'
        });

        console.log('Created on-duty log:', onDutyLog.id);

        // Test the stats endpoint logic
        const OnDutyLog = db.on_duty_logs;
        const { Op } = require("sequelize");

        const pendingCount = await db.leave_requests.count({ where: { staff_id: staff.staffid, status: 'Pending' } });
        const approvedCount = await db.leave_requests.count({ where: { staff_id: staff.staffid, status: 'Approved' } });
        const rejectedCount = await db.leave_requests.count({ where: { staff_id: staff.staffid, status: 'Rejected' } });
        const totalLeaves = await db.leave_requests.count({ where: { staff_id: staff.staffid } });
        const rejectedOnDutyCount = await OnDutyLog.count({ where: { staff_id: staff.staffid, status: 'Rejected' } });
        const onDutyCount = await OnDutyLog.count({ where: { staff_id: staff.staffid } });
        const activeOnDutyCount = await OnDutyLog.count({ where: { staff_id: staff.staffid, end_time: null } });

        const pendingOnDutyCount = await OnDutyLog.count({
            where: {
                staff_id: staff.staffid,
                status: 'Pending',
                end_time: { [Op.ne]: null }
            }
        });

        const stats = {
            totalLeaves: totalLeaves,
            pendingLeaves: pendingCount + pendingOnDutyCount,
            approvedLeaves: approvedCount,
            rejectedLeaves: rejectedCount + rejectedOnDutyCount,
            activeOnDuty: activeOnDutyCount,
            onDutyLeaves: onDutyCount
        };

        console.log('Stats:', JSON.stringify(stats, null, 2));

        // Clean up
        await onDutyLog.destroy();
        console.log('Test completed');

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();

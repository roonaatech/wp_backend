
const db = require("./models");
const Op = db.Sequelize.Op;
const LeaveRequest = db.leave_requests;
const OnDutyLog = db.on_duty_logs;
const Staff = db.user;

async function testReports() {
    try {
        console.log("Connecting to DB...");
        await db.sequelize.authenticate();
        console.log("Connection has been established successfully.");

        // Simulate admin user
        const userId = 1; // Assuming 1 is admin

        console.log("Fetching user...");
        const currentUser = await Staff.findByPk(userId);
        if (!currentUser) {
            console.log("User 1 not found!");
            return;
        }
        console.log("User found:", currentUser.firstname);

        const isAdmin = currentUser.admin === 1;
        console.log("Is Admin:", isAdmin);

        // Fetch Leave Requests
        console.log("Fetching Leave Requests...");
        const leaveRequests = await LeaveRequest.findAll({
            include: [
                { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                {
                    model: db.user,
                    as: 'approver',
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    required: false
                }
            ],
            limit: 5
        });
        console.log(`Found ${leaveRequests.length} leave requests.`);

        // Fetch OnDuty Logs
        console.log("Fetching OnDuty Logs...");
        const onDutyLogs = await OnDutyLog.findAll({
            include: [
                { model: db.user, as: 'user', attributes: ['staffid', 'firstname', 'lastname', 'email'] },
                {
                    model: db.user,
                    as: 'approver',
                    attributes: ['staffid', 'firstname', 'lastname', 'email'],
                    required: false
                }
            ],
            limit: 5
        });
        console.log(`Found ${onDutyLogs.length} on-duty logs.`);

        console.log("Success!");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await db.sequelize.close();
    }
}

testReports();

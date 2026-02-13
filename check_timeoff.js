const db = require("./models");
const TimeOffRequest = db.time_off_requests;

async function checkTimeOffs() {
    try {
        await db.sequelize.sync();
        console.log("Database connected.");

        const count = await TimeOffRequest.count();
        console.log(`Total Time-Off Requests in DB: ${count}`);

        const requests = await TimeOffRequest.findAll({ limit: 5 });
        console.log("Sample Time-Off Requests:", JSON.stringify(requests, null, 2));

    } catch (error) {
        console.error("Error checking time-offs:", error);
    } finally {
        process.exit();
    }
}

checkTimeOffs();

const db = require("./models");
const controller = require("./controllers/admin.controller");

async function testController() {
    await db.sequelize.sync();

    // Mock Request
    const req = {
        userId: 1, // Assuming ID 1 is the Admin/Manager who should see these
        query: {
            year: 2026,
            month: 2
        }
    };

    // Mock Response
    const res = {
        send: (data) => {
            console.log("Response Data (Events):", Array.isArray(data) ? `Found ${data.length} events` : data);
            if (Array.isArray(data)) {
                const timeOffs = data.filter(e => e.type === 'time_off');
                console.log(`Time-Off Events Found: ${timeOffs.length}`);
                if (timeOffs.length > 0) {
                    console.log("Sample Time-Off:", timeOffs[0]);
                }
            }
        },
        status: (code) => {
            console.log("Response Status:", code);
            return {
                send: (msg) => console.log("Response Message:", msg)
            };
        }
    };

    console.log("Testing getCalendarEvents controller...");
    try {
        await controller.getCalendarEvents(req, res);
    } catch (err) {
        console.error("Controller Error:", err);
    } finally {
        process.exit();
    }
}

testController();

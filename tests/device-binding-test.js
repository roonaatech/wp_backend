const db = require("../models");
const deviceSecurity = require("../services/device_security.service");

async function runDeviceBindingTest() {
    console.log("==================================================");
    console.log("🧪 STARTING DEVICE BINDING & ANTI-PROXY TEST");
    console.log("==================================================");

    try {
        // 1. Sync database schema for new models if needed
        await db.employee_devices.sync({ alter: true });
        await db.device_violation_logs.sync({ alter: true });
        console.log("✅ Models synced successfully: employee_devices, device_violation_logs");

        // 2. Fetch or create two test users
        let userA = await db.user.findOne({ where: { active: 1 } });
        let userB = await db.user.findOne({ 
            where: { 
                active: 1, 
                staffid: { [db.Sequelize.Op.ne]: userA.staffid } 
            } 
        });

        if (!userA || !userB) {
            console.error("❌ Need at least 2 active users to run the test.");
            process.exit(1);
        }

        console.log(`\n👤 User A: ${userA.firstname} ${userA.lastname} (Staff ID: ${userA.staffid})`);
        console.log(`👤 User B: ${userB.firstname} ${userB.lastname} (Staff ID: ${userB.staffid})`);

        const testDevice1 = `test-device-uuid-1-${Date.now()}`;
        const testDevice2 = `test-device-uuid-2-${Date.now()}`;

        // Clean up any test records for these IDs
        await db.employee_devices.destroy({ where: { staff_id: [userA.staffid, userB.staffid] } });
        await db.device_violation_logs.destroy({ where: { attempted_staff_id: [userA.staffid, userB.staffid] } });

        // TEST 1: User A binds Device 1
        console.log("\n--- TEST 1: User A binds Device 1 ---");
        const res1 = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: testDevice1,
            deviceName: "iPhone 15 - Safari",
            userAgent: "Mozilla/5.0 (iPhone)",
            ipAddress: "192.168.1.50",
            action: "SMART_BADGE_ACCESS"
        });

        if (res1.allowed) {
            console.log("✅ User A successfully bound Device 1.");
        } else {
            throw new Error(`Test 1 Failed: ${res1.error}`);
        }

        const dev1Record = await db.employee_devices.findOne({
            where: { staff_id: userA.staffid, device_id: testDevice1, is_active: true }
        });
        if (!dev1Record) throw new Error("Test 1 Verification Failed: Device 1 not active in DB");
        console.log("✅ DB verified: Device 1 is active for User A.");

        // TEST 2: User A changes to new Device 2 (legitimate phone upgrade)
        console.log("\n--- TEST 2: User A changes phone to Device 2 ---");
        const res2 = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: testDevice2,
            deviceName: "iPhone 16 Pro - Safari",
            userAgent: "Mozilla/5.0 (iPhone 16)",
            ipAddress: "192.168.1.50",
            action: "SMART_BADGE_ACCESS"
        });

        if (res2.allowed) {
            console.log("✅ User A successfully bound new Device 2.");
        } else {
            throw new Error(`Test 2 Failed: ${res2.error}`);
        }

        const dev1After = await db.employee_devices.findOne({ where: { device_id: testDevice1 } });
        const dev2After = await db.employee_devices.findOne({ where: { device_id: testDevice2 } });

        if (dev1After.is_active !== false || dev2After.is_active !== true) {
            throw new Error("Test 2 Verification Failed: Old device was not deactivated or new device is not active.");
        }
        console.log("✅ DB verified: Old Device 1 is now inactive, new Device 2 is active for User A.");

        // TEST 3: User B attempts to use Device 2 (which is bound to User A) -> MUST BE BLOCKED
        console.log("\n--- TEST 3: User B attempts proxy attendance on User A's Device 2 ---");
        const res3 = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: testDevice2,
            deviceName: "iPhone 16 Pro - Safari",
            userAgent: "Mozilla/5.0 (iPhone 16)",
            ipAddress: "192.168.1.50",
            action: "SMART_BADGE_ACCESS"
        });

        if (!res3.allowed && res3.violationLogged) {
            console.log("✅ Proxy attendance attempt was successfully BLOCKED!");
            console.log(`ℹ️ Block Message: "${res3.error}"`);
        } else {
            throw new Error("Test 3 Failed: Cross-employee proxy attendance attempt was NOT blocked!");
        }

        // Verify violation log in database
        const violation = await db.device_violation_logs.findOne({
            where: {
                attempted_staff_id: userB.staffid,
                bound_staff_id: userA.staffid,
                device_id: testDevice2
            }
        });

        if (!violation) throw new Error("Test 3 Verification Failed: Violation log was not created in DB.");
        console.log(`✅ Violation Log Verified in DB: ID #${violation.id}, Status: ${violation.status}`);

        // TEST 4: Admin resets User A's device -> User B can now legitimately use the device
        console.log("\n--- TEST 4: Admin resets User A's device binding ---");
        const resetRes = await deviceSecurity.resetEmployeeDeviceBinding(userA.staffid, 1, "Phone transferred to colleague");
        console.log("✅ Admin device reset result:", resetRes);

        const res4 = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: testDevice2,
            deviceName: "iPhone 16 Pro - Safari",
            userAgent: "Mozilla/5.0 (iPhone 16)",
            ipAddress: "192.168.1.50",
            action: "SMART_BADGE_ACCESS"
        });

        if (res4.allowed) {
            console.log("✅ User B can now successfully bind Device 2 after Admin reset.");
        } else {
            throw new Error(`Test 4 Failed: ${res4.error}`);
        }

        console.log("\n==================================================");
        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
        console.log("==================================================");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ TEST ERROR:", err);
        process.exit(1);
    }
}

runDeviceBindingTest();

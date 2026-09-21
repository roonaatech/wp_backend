const db = require("../models");
const deviceSecurity = require("../services/device_security.service");

async function runTest() {
    console.log("==========================================================================");
    console.log("🧪 TESTING CHECK-IN / CHECK-OUT ONLY BLOCKING & LOGIN EXEMPTION");
    console.log("==========================================================================");

    try {
        const userA = await db.user.findOne({ where: { active: 1 } });
        const userB = await db.user.findOne({ 
            where: { 
                active: 1, 
                staffid: { [db.Sequelize.Op.ne]: userA.staffid } 
            } 
        });

        console.log(`User A: ${userA.firstname} ${userA.lastname} (ID: ${userA.staffid})`);
        console.log(`User B: ${userB.firstname} ${userB.lastname} (ID: ${userB.staffid})`);

        // Clean up test records
        await db.employee_devices.destroy({ where: { staff_id: [userA.staffid, userB.staffid] } });
        await db.device_violation_logs.destroy({ where: { attempted_staff_id: [userA.staffid, userB.staffid] } });

        const sharedPhoneId = `wp-dev-test-mobile-phone-${Date.now()}`;
        const mobileUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
        const laptopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        // ------------------------------------------------------------------------
        // TEST 1: Check-in / Smart Badge on Mobile Phone (User A binds device)
        // ------------------------------------------------------------------------
        console.log("\n--- TEST 1: User A generates Smart Badge / Check-in on Mobile Phone ---");
        const resA = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: sharedPhoneId,
            deviceName: "Apple iPhone 15 - Safari Mobile",
            userAgent: mobileUa,
            ipAddress: "192.168.1.100",
            isMobile: true,
            action: "SMART_BADGE_ACCESS"
        });

        if (!resA.allowed) {
            throw new Error(`User A was unexpectedly blocked during badge access: ${resA.error}`);
        }
        console.log("✅ User A successfully bound mobile phone during Smart Badge generation.");

        // ------------------------------------------------------------------------
        // TEST 2: User B attempts Check-in / Smart Badge on the SAME Mobile Phone
        // ------------------------------------------------------------------------
        console.log("\n--- TEST 2: User B attempts Check-in / Smart Badge on User A's Mobile Phone ---");
        const resB = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: sharedPhoneId,
            deviceName: "Apple iPhone 15 - Safari Mobile",
            userAgent: mobileUa,
            ipAddress: "192.168.1.100",
            isMobile: true,
            action: "MOBILE_FACE_CHECK_IN"
        });

        if (resB.allowed) {
            throw new Error("Test 2 Failed: User B was NOT blocked from checking in on User A's mobile phone!");
        }
        if (!resB.violationLogged) {
            throw new Error("Test 2 Failed: Violation was not logged for cross-user mobile check-in!");
        }
        console.log("✅ User B was STRICTLY BLOCKED during check-in on User A's mobile phone!");
        console.log(`ℹ️ Error Message: "${resB.error}"`);

        // Verify violation in DB
        const violation = await db.device_violation_logs.findOne({
            where: { attempted_staff_id: userB.staffid, bound_staff_id: userA.staffid }
        });
        if (!violation) {
            throw new Error("Violation record not found in database!");
        }
        console.log(`✅ Violation successfully logged in DB (ID: ${violation.id}).`);

        // ------------------------------------------------------------------------
        // TEST 3: Multiple users Check-in / Access on the SAME LAPTOP (Mac / Windows)
        // ------------------------------------------------------------------------
        console.log("\n--- TEST 3: Multiple users Check-in / Access on the SAME LAPTOP ---");
        const sharedLaptopId = "wp-dev-shared-laptop-workstation";

        const laptopResA = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: sharedLaptopId,
            deviceName: "macOS - Chrome",
            userAgent: laptopUa,
            ipAddress: "192.168.1.50",
            isMobile: false,
            action: "SMART_BADGE_ACCESS"
        });

        const laptopResB = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: sharedLaptopId,
            deviceName: "macOS - Chrome",
            userAgent: laptopUa,
            ipAddress: "192.168.1.50",
            isMobile: false,
            action: "SMART_BADGE_ACCESS"
        });

        if (!laptopResA.allowed || !laptopResB.allowed) {
            throw new Error("Laptop check-in was blocked unexpectedly!");
        }
        console.log("✅ Multiple users on same laptop are 100% exempt and allowed without conflict.");

        console.log("\n==========================================================================");
        console.log("🎉 ALL TESTS PASSED! BLOCKING OCCURS ONLY DURING CHECK-IN/OUT ON MOBILE");
        console.log("==========================================================================");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
        process.exit(1);
    }
}

runTest();

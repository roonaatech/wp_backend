const db = require("../models");
const deviceSecurity = require("../services/device_security.service");

async function runTest() {
    console.log("===============================================================");
    console.log("🧪 TESTING MOBILE-ONLY SECURITY ENFORCEMENT & LAPTOP EXEMPTION");
    console.log("===============================================================");

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

        // Clean up any test device records
        await db.employee_devices.destroy({ where: { staff_id: [userA.staffid, userB.staffid] } });
        await db.device_violation_logs.destroy({ where: { attempted_staff_id: [userA.staffid, userB.staffid] } });

        // -------------------------------------------------------------
        // SCENARIO 1: Multiple users logging in on the SAME LAPTOP
        // -------------------------------------------------------------
        console.log("\n--- SCENARIO 1: Multiple users logging in on the SAME LAPTOP (Mac/Windows) ---");
        const laptopUaMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const laptopUaWin = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const sharedLaptopDeviceId = "wp-dev-macbook-pro-office-shared";

        console.log("Step 1.1: User A logs in from office MacBook...");
        const laptopResA = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: sharedLaptopDeviceId,
            deviceName: "macOS - Chrome",
            userAgent: laptopUaMac,
            ipAddress: "192.168.1.50",
            isMobile: false,
            action: "WEBAPP_LOGIN"
        });

        if (!laptopResA.allowed) {
            throw new Error(`User A was unexpectedly blocked on laptop: ${laptopResA.error}`);
        }
        console.log("✅ User A successfully logged in on Laptop (isDesktop exemption active).");

        console.log("Step 1.2: User B logs in from the SAME office MacBook...");
        const laptopResB = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: sharedLaptopDeviceId,
            deviceName: "macOS - Chrome",
            userAgent: laptopUaMac,
            ipAddress: "192.168.1.50",
            isMobile: false,
            action: "WEBAPP_LOGIN"
        });

        if (!laptopResB.allowed) {
            throw new Error(`User B was unexpectedly blocked on the same laptop: ${laptopResB.error}`);
        }
        console.log("✅ User B successfully logged in on the same Laptop (NO BLOCKING, NO CONFLICT!).");

        // Verify that NO violations were created for laptop logins
        const violationCountLaptop = await db.device_violation_logs.count({
            where: { attempted_staff_id: [userA.staffid, userB.staffid] }
        });
        if (violationCountLaptop !== 0) {
            throw new Error(`Violations were unexpectedly logged for laptop logins! Count: ${violationCountLaptop}`);
        }
        console.log("✅ Verified 0 violations logged for shared laptop logins.");

        // -------------------------------------------------------------
        // SCENARIO 2: Mobile Security Enforcement (1 Phone per Employee)
        // -------------------------------------------------------------
        console.log("\n--- SCENARIO 2: Mobile App / Mobile Browser Security Enforcement ---");
        const mobilePhoneId = `wp-dev-phone-${Date.now()}`;
        const mobileUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

        console.log(`Step 2.1: User A logs in on Mobile Phone (${mobilePhoneId})...`);
        const mobileResA = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: mobilePhoneId,
            deviceName: "Apple iPhone 15 - Safari Mobile",
            userAgent: mobileUa,
            ipAddress: "192.168.1.105",
            isMobile: true,
            action: "MOBILE_LOGIN"
        });

        if (!mobileResA.allowed) {
            throw new Error(`User A mobile login failed: ${mobileResA.error}`);
        }
        console.log("✅ User A successfully registered and bound mobile phone.");

        console.log("Step 2.2: User B attempts to log in from the SAME Mobile Phone...");
        const mobileResB = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: mobilePhoneId,
            deviceName: "Apple iPhone 15 - Safari Mobile",
            userAgent: mobileUa,
            ipAddress: "192.168.1.105",
            isMobile: true,
            action: "MOBILE_LOGIN"
        });

        if (mobileResB.allowed) {
            throw new Error("User B was NOT blocked on User A's mobile phone!");
        }
        if (!mobileResB.violationLogged) {
            throw new Error("Violation was not flagged for cross-user mobile login!");
        }
        console.log("✅ User B was STRICTLY BLOCKED on User A's mobile phone.");
        console.log(`ℹ️ Violation Error: "${mobileResB.error}"`);

        // Verify violation record exists
        const violationRecord = await db.device_violation_logs.findOne({
            where: { attempted_staff_id: userB.staffid, bound_staff_id: userA.staffid }
        });
        if (!violationRecord) {
            throw new Error("Violation record not found in database!");
        }
        console.log(`✅ Security violation correctly logged in database (ID: ${violationRecord.id}).`);

        // -------------------------------------------------------------
        // SCENARIO 3: User B logs into Laptop after being blocked on mobile
        // -------------------------------------------------------------
        console.log("\n--- SCENARIO 3: User B logs into Laptop after Mobile Block ---");
        const userBLaptopRes = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: "wp-dev-user-b-personal-laptop",
            deviceName: "Windows PC - Chrome",
            userAgent: laptopUaWin,
            ipAddress: "192.168.1.80",
            isMobile: false,
            action: "WEBAPP_LOGIN"
        });

        if (!userBLaptopRes.allowed) {
            throw new Error(`User B was blocked on laptop: ${userBLaptopRes.error}`);
        }
        console.log("✅ User B can freely log into laptop/desktop without any restriction!");

        console.log("\n===============================================================");
        console.log("🎉 ALL TESTS PASSED! MOBILE SECURITY + LAPTOP EXEMPTION VERIFIED");
        console.log("===============================================================");
        process.exit(0);

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
        process.exit(1);
    }
}

runTest();

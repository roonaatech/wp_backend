const db = require("../models");
const deviceSecurity = require("../services/device_security.service");
const badgeSecurity = require("../services/badge_security.service");

async function runSingleUserMobileAttendanceTest() {
    console.log("==========================================================================");
    console.log("🧪 RUNNING SINGLE-USER MOBILE ATTENDANCE SECURITY & CROSS-PLATFORM TEST");
    console.log("==========================================================================");

    try {
        const users = await db.user.findAll({ where: { active: 1 }, limit: 3 });
        if (users.length < 2) {
            throw new Error("Need at least 2 active users to run the test.");
        }

        const user1 = users[0];
        const user2 = users[1];

        console.log(`User 1: ${user1.firstname} ${user1.lastname} (Staff ID: ${user1.staffid})`);
        console.log(`User 2: ${user2.firstname} ${user2.lastname} (Staff ID: ${user2.staffid})`);

        // Clean up test records
        await db.employee_devices.destroy({
            where: { staff_id: [user1.staffid, user2.staffid] }
        });
        await db.device_violation_logs.destroy({
            where: { attempted_staff_id: [user1.staffid, user2.staffid] }
        });

        const physicalMobileDeviceId = `wp-dev-app-galaxy-s23-${Date.now()}`;
        const mobileAppUa = "Dart/3.3 (dart:io)";
        const mobileBrowserUa = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
        const mobileBrowserDeviceId = `wp-dev-hash123-browser-uuid-${Date.now()}`;

        // ---------------------------------------------------------------------------------
        // STEP 1: User 1 accesses attendance on the mobile phone via WorkPulse Mobile App
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 1: User 1 requests dynamic attendance badge via WorkPulse Mobile App ---");
        const user1AppCheck = await deviceSecurity.verifyAndBindDevice({
            staffId: user1.staffid,
            deviceId: physicalMobileDeviceId,
            deviceName: "Samsung SM-S911B (Android 14)",
            userAgent: mobileAppUa,
            ipAddress: "192.168.1.100",
            isMobile: true,
            isMobileApp: true,
            action: "SMART_BADGE_ACCESS"
        });

        if (!user1AppCheck.allowed) {
            throw new Error(`User 1 mobile app badge request failed: ${user1AppCheck.error}`);
        }
        console.log("✅ User 1 successfully verified and bound device to WorkPulse Mobile App.");

        // Generate badge token for User 1
        const user1TokenData = badgeSecurity.generateBadgeToken({
            staffId: user1.staffid,
            email: user1.email,
            name: `${user1.firstname} ${user1.lastname}`,
            deviceId: physicalMobileDeviceId,
            isMobileApp: true
        });
        console.log("✅ Dynamic QR badge token generated for User 1 with bound device ID embedded.");

        // ---------------------------------------------------------------------------------
        // STEP 2: User 2 on a SEPARATE phone on the SAME office Wi-Fi IP is ALLOWED
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 2: User 2 uses their OWN separate phone on the SAME office Wi-Fi IP ---");
        const user2SeparatePhoneId = `wp-dev-app-user2-phone-${Date.now()}`;
        const user2SeparateCheck = await deviceSecurity.verifyAndBindDevice({
            staffId: user2.staffid,
            deviceId: user2SeparatePhoneId,
            deviceName: "Android Device - Samsung SM-S911B",
            userAgent: mobileAppUa,
            ipAddress: "192.168.1.100", // Same office Wi-Fi IP!
            isMobile: true,
            isMobileApp: true,
            action: "SMART_BADGE_ACCESS"
        });

        if (!user2SeparateCheck.allowed) {
            throw new Error(`FALSE POSITIVE BUG: User 2 was blocked on their own phone simply because they shared office Wi-Fi IP with User 1: ${user2SeparateCheck.error}`);
        }
        console.log("✅ User 2 successfully verified on their own phone without false conflict on shared Wi-Fi.");

        // Clean User 2 separate device for next steps
        await db.employee_devices.destroy({ where: { staff_id: user2.staffid } });

        // ---------------------------------------------------------------------------------
        // STEP 3: User 2 opens the WorkPulse Mobile App on the SAME phone to check in
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 3: User 2 opens WorkPulse Mobile App on User 1's phone ---");
        const user2AppCheck = await deviceSecurity.verifyAndBindDevice({
            staffId: user2.staffid,
            deviceId: physicalMobileDeviceId, // Same phone hardware ID
            deviceName: "Samsung SM-S911B (Android 14)",
            userAgent: mobileAppUa,
            ipAddress: "192.168.1.100",
            isMobile: true,
            isMobileApp: true,
            action: "SMART_BADGE_ACCESS"
        });

        if (user2AppCheck.allowed) {
            throw new Error("SECURITY FAILURE: User 2 was allowed on User 1's bound mobile phone!");
        }
        if (!user2AppCheck.violationLogged) {
            throw new Error("Expected violationLogged: true for cross-user mobile app attempt!");
        }
        console.log("✅ User 2 was STRICTLY BLOCKED with a device conflict violation on User 1's phone:");
        console.log(`   ℹ️ Error: "${user2AppCheck.error}"`);

        // ---------------------------------------------------------------------------------
        // STEP 4: Admin resets User 1's device binding -> Device is freed for User 2!
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 4: Admin resets User 1's device binding ---");
        const resetRes = await deviceSecurity.resetEmployeeDeviceBinding(user1.staffid, 1, "Admin reset mobile binding");
        console.log(`✅ Admin reset result: count = ${resetRes.count}`);

        // Verify User 1's device is now inactive in DB
        const user1DeviceAfterReset = await db.employee_devices.findOne({
            where: { staff_id: user1.staffid, is_active: true }
        });
        if (user1DeviceAfterReset) {
            throw new Error("Expected User 1 device to be inactive after admin reset!");
        }
        console.log("✅ Verified User 1 has no active device binding in database.");

        // ---------------------------------------------------------------------------------
        // STEP 5: User 2 binds this phone on Mobile App after User 1 reset -> ALLOWED & BOUND!
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 5: User 2 binds the transferred phone on Mobile App after User 1 reset ---");
        const user2AllowedCheck = await deviceSecurity.verifyAndBindDevice({
            staffId: user2.staffid,
            deviceId: physicalMobileDeviceId,
            deviceName: "Samsung SM-S911B (Android 14)",
            userAgent: mobileAppUa,
            ipAddress: "192.168.1.100",
            isMobile: true,
            isMobileApp: true,
            action: "SMART_BADGE_ACCESS"
        });

        if (!user2AllowedCheck.allowed) {
            throw new Error(`SECURITY FAILURE: User 2 was blocked after User 1 binding was cleared: ${user2AllowedCheck.error}`);
        }
        console.log("✅ User 2 is now successfully ALLOWED and bound to the device!");

        // Verify User 2 is now actively bound
        const user2BoundDevice = await db.employee_devices.findOne({
            where: { staff_id: user2.staffid, is_active: true }
        });
        if (!user2BoundDevice) {
            throw new Error("Expected User 2 to have an active device binding in database!");
        }
        console.log(`✅ User 2 device record verified in database (ID: ${user2BoundDevice.id}, Staff ID: ${user2BoundDevice.staff_id}).`);

        // ---------------------------------------------------------------------------------
        // STEP 6: Now User 1 attempts badge on this phone -> BLOCKED because it belongs to User 2!
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 6: User 1 now attempts badge on the same phone ---");
        const user1BlockedCheck = await deviceSecurity.verifyAndBindDevice({
            staffId: user1.staffid,
            deviceId: physicalMobileDeviceId,
            deviceName: "Samsung SM-S911B (Android 14)",
            userAgent: mobileAppUa,
            ipAddress: "192.168.1.100",
            isMobile: true,
            isMobileApp: true,
            action: "SMART_BADGE_ACCESS"
        });

        if (user1BlockedCheck.allowed) {
            throw new Error("SECURITY FAILURE: User 1 was allowed on a device now bound to User 2!");
        }
        console.log("✅ User 1 was correctly BLOCKED because the phone is now actively bound to User 2.");

        // ---------------------------------------------------------------------------------
        // STEP 7: Desktop / Laptop browsers remain completely exempt and unblocked
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 7: Desktop / Laptop browsers exemption verification ---");
        const desktopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const desktopRes = await deviceSecurity.verifyAndBindDevice({
            staffId: user2.staffid,
            deviceId: "wp-dev-office-macbook-shared",
            deviceName: "macOS - Chrome",
            userAgent: desktopUa,
            ipAddress: "192.168.1.50",
            isMobile: false,
            action: "WEBAPP_LOGIN"
        });

        if (!desktopRes.allowed || !desktopRes.isDesktop) {
            throw new Error(`Desktop access was unexpectedly restricted: ${JSON.stringify(desktopRes)}`);
        }
        console.log("✅ Desktop / Laptop browsers remain 100% exempt and functional.");

        console.log("\n==========================================================================");
        console.log("🎉 ALL TESTS PASSED: Single-user mobile attendance strictly enforced!");
        console.log("==========================================================================");

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
        process.exit(1);
    } finally {
        await new Promise(r => setTimeout(r, 1500));
        await db.sequelize.close();
    }
}

runSingleUserMobileAttendanceTest();

const db = require("../models");
const badgeSecurity = require("../services/badge_security.service");
const deviceSecurity = require("../services/device_security.service");

async function runTests() {
    console.log("==================================================");
    console.log("🧪 TESTING STRICT QR EXPIRATION & CROSS-USER BLOCK");
    console.log("==================================================");

    try {
        // --- TEST 1: STRICT QR EXPIRATION ---
        console.log("\n--- TEST 1: QR Token Expiration Test ---");
        const tokenData = badgeSecurity.generateBadgeToken({
            staffId: 1,
            email: "test@roonaa.com",
            name: "Test User"
        });

        console.log(`Generated QR Token: ${tokenData.token.substring(0, 35)}... (TTL: ${tokenData.ttlSeconds}s)`);

        // Immediate check
        const initialCheck = badgeSecurity.verifyBadgeToken(tokenData.token);
        if (!initialCheck.valid) {
            throw new Error(`Immediate QR verification failed: ${initialCheck.error}`);
        }
        console.log("✅ Immediate QR scan: Valid");

        // Expired token test (artificially backdated or tested with strict TTL)
        console.log("Simulating verification after 20 seconds (expired token)...");
        // Create an expired token by mocking expiration in past
        const now = Date.now();
        const expiredPayload = {
            sid: 1,
            em: "test@roonaa.com",
            nm: "Test User",
            iat: now - 20000,
            exp: now - 5000, // expired 5 seconds ago
            nc: "test-expired-nonce"
        };
        const crypto = require("crypto");
        const BADGE_SECRET = process.env.BADGE_SECRET || process.env.JWT_SECRET || 'workpulse-dynamic-badge-secret-key-2026';
        const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
        const signature = crypto.createHmac('sha256', BADGE_SECRET).update(payloadBase64).digest('base64url');
        const expiredToken = `WPQR.${payloadBase64}.${signature}`;

        const expiredCheck = badgeSecurity.verifyBadgeToken(expiredToken);
        if (!expiredCheck.valid && expiredCheck.error.includes("expired")) {
            console.log(`✅ Expired QR scan after 20s successfully REJECTED with: "${expiredCheck.error}"`);
        } else {
            throw new Error(`Test 1 Failed: Expired QR was accepted or gave wrong error: ${JSON.stringify(expiredCheck)}`);
        }

        // --- TEST 2: SAME MOBILE DEVICE CROSS-USER CONFLICT ---
        console.log("\n--- TEST 2: Device Persistence & Cross-User Login Conflict Test ---");
        const userA = await db.user.findOne({ where: { active: 1 } });
        const userB = await db.user.findOne({ 
            where: { 
                active: 1, 
                staffid: { [db.Sequelize.Op.ne]: userA.staffid } 
            } 
        });

        const mobileDeviceId = `wp-dev-test-persistent-phone-${Date.now()}`;
        console.log(`📱 Mobile Device ID: ${mobileDeviceId}`);

        // Clean any existing bindings
        await db.employee_devices.destroy({ where: { staff_id: [userA.staffid, userB.staffid] } });

        // Step 1: User A logs in on this mobile device
        console.log(`Step 1: User A (${userA.firstname}) logs in & uses badge on mobile phone...`);
        const resA = await deviceSecurity.verifyAndBindDevice({
            staffId: userA.staffid,
            deviceId: mobileDeviceId,
            deviceName: "Apple iPhone 15 - Mobile Safari",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            ipAddress: "192.168.1.100",
            action: "MOBILE_LOGIN"
        });

        if (!resA.allowed) throw new Error(`User A login failed: ${resA.error}`);
        console.log("✅ User A successfully bound mobile phone.");

        // Step 2: User A logs out (device ID remains in cookie/localStorage on phone)
        // Step 3: User B tries to log in on the SAME mobile phone
        console.log(`Step 2: User B (${userB.firstname}) tries to log in / access badge from the SAME mobile phone...`);
        const resB = await deviceSecurity.verifyAndBindDevice({
            staffId: userB.staffid,
            deviceId: mobileDeviceId,
            deviceName: "Apple iPhone 15 - Mobile Safari",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            ipAddress: "192.168.1.100",
            action: "MOBILE_LOGIN"
        });

        if (!resB.allowed && resB.violationLogged) {
            console.log("✅ User B was successfully BLOCKED from using User A's mobile phone!");
            console.log(`ℹ️ Error Message: "${resB.error}"`);
        } else {
            throw new Error("Test 2 Failed: User B was NOT blocked on User A's mobile phone!");
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

runTests();

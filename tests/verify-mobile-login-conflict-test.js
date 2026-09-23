const db = require("../models");
const authController = require("../controllers/auth.controller");
const deviceSecurity = require("../services/device_security.service");
const bcrypt = require("bcryptjs");

// Mock express request and response objects
function createMockReqRes({ body = {}, headers = {}, ip = '192.168.1.100' } = {}) {
    const req = {
        body,
        headers: {
            'x-forwarded-for': ip,
            ...headers
        },
        connection: { remoteAddress: ip },
        socket: { remoteAddress: ip },
        get: (header) => headers[header.toLowerCase()] || headers[header]
    };

    let statusCode = 200;
    let responseData = null;

    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        send: (data) => {
            responseData = data;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        }
    };

    return {
        req,
        res,
        getStatus: () => statusCode,
        getData: () => responseData
    };
}

async function runMobileLoginConflictTest() {
    console.log("==========================================================================");
    console.log("🧪 RUNNING END-TO-END MOBILE LOGIN & CROSS-PLATFORM DEVICE CONFLICT TEST");
    console.log("==========================================================================");

    try {
        const users = await db.user.findAll({ where: { active: 1 }, limit: 3 });
        if (users.length < 2) {
            throw new Error("Need at least 2 active users to run the test.");
        }

        const user1 = users[0];
        const user2 = users[1];

        // Ensure both users have a known test password
        const testPassword = "Password@123";
        const hashedPassword = bcrypt.hashSync(testPassword, 10);
        await user1.update({ password: hashedPassword });
        await user2.update({ password: hashedPassword });

        console.log(`User 1: ${user1.firstname} ${user1.lastname} (Staff ID: ${user1.staffid}, Email: ${user1.email})`);
        console.log(`User 2: ${user2.firstname} ${user2.lastname} (Staff ID: ${user2.staffid}, Email: ${user2.email})`);

        // Clean up any existing devices and violation logs for these users
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
        const testIp = "192.168.1.100";

        // ---------------------------------------------------------------------------------
        // STEP 1: User 1 logs in via WorkPulse Mobile App
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 1: User 1 logs in via WorkPulse Mobile App on their phone ---");
        const mock1 = createMockReqRes({
            body: {
                email: user1.email,
                password: testPassword,
                forceLocal: true,
                is_mobile_app: true,
                client_type: 'mobile_app',
                deviceId: physicalMobileDeviceId,
                deviceName: "Samsung SM-S911B (Android 14)"
            },
            headers: {
                'x-is-mobile': 'true',
                'x-is-mobile-app': 'true',
                'x-device-id': physicalMobileDeviceId,
                'x-device-name': "Samsung SM-S911B (Android 14)",
                'user-agent': mobileAppUa
            },
            ip: testIp
        });

        await authController.signin(mock1.req, mock1.res);
        const status1 = mock1.getStatus();
        const data1 = mock1.getData();

        if (status1 !== 200 || !data1.accessToken) {
            throw new Error(`User 1 mobile app login failed! Status: ${status1}, Data: ${JSON.stringify(data1)}`);
        }
        console.log("✅ User 1 successfully logged in on Mobile App. Token received.");

        // Verify device was bound to User 1 in database
        const boundDeviceUser1 = await db.employee_devices.findOne({
            where: { staff_id: user1.staffid, is_active: true }
        });
        if (!boundDeviceUser1) {
            throw new Error("Device was not bound to User 1 in database!");
        }
        console.log(`✅ Device actively bound to User 1 in database (Device ID: ${boundDeviceUser1.device_id}, Staff ID: ${boundDeviceUser1.staff_id}).`);

        // ---------------------------------------------------------------------------------
        // STEP 2: On the SAME mobile phone, User 2 attempts to log in via Mobile Web Browser
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 2: User 2 attempts to LOG IN via Mobile Web Browser on the SAME phone ---");
        const mock2 = createMockReqRes({
            body: {
                email: user2.email,
                password: testPassword,
                forceLocal: true,
                client_type: 'mobile_browser',
                deviceId: mobileBrowserDeviceId,
                deviceName: "Android Device - Chrome (393x873)",
                is_mobile: true
            },
            headers: {
                'x-is-mobile': 'true',
                'x-device-id': mobileBrowserDeviceId,
                'x-device-name': "Android Device - Chrome (393x873)",
                'user-agent': mobileBrowserUa
            },
            ip: testIp
        });

        await authController.signin(mock2.req, mock2.res);
        const status2 = mock2.getStatus();
        const data2 = mock2.getData();

        if (status2 !== 403 || !data2.deviceViolation) {
            throw new Error(`SECURITY FAILURE: User 2 was able to log in on User 1's mobile phone! Status: ${status2}, Data: ${JSON.stringify(data2)}`);
        }
        console.log("✅ User 2 was STRICTLY BLOCKED from logging in on mobile browser with 403 Device Violation!");
        console.log(`   ℹ️ Message: "${data2.message}"`);

        // ---------------------------------------------------------------------------------
        // STEP 3: Admin clears/resets User 1's device binding -> Mobile device is freed!
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 3: Admin resets User 1's device binding ---");
        const resetRes = await deviceSecurity.resetEmployeeDeviceBinding(user1.staffid, 1, "Admin reset mobile binding");
        console.log(`✅ Admin reset result: count = ${resetRes.count}`);

        // Verify User 1's device is now inactive
        const user1ActiveCheck = await db.employee_devices.findOne({
            where: { staff_id: user1.staffid, is_active: true }
        });
        if (user1ActiveCheck) {
            throw new Error("Expected User 1 device to be inactive after admin reset!");
        }
        console.log("✅ Verified User 1 has no active device binding in database.");

        // ---------------------------------------------------------------------------------
        // STEP 4: User 2 re-attempts login on Mobile Browser on that phone -> SUCCEEDS & BOUND!
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 4: User 2 re-attempts login on Mobile Web Browser after User 1 reset ---");
        const mock4 = createMockReqRes({
            body: {
                email: user2.email,
                password: testPassword,
                forceLocal: true,
                client_type: 'mobile_browser',
                deviceId: mobileBrowserDeviceId,
                deviceName: "Android Device - Chrome (393x873)",
                is_mobile: true
            },
            headers: {
                'x-is-mobile': 'true',
                'x-device-id': mobileBrowserDeviceId,
                'x-device-name': "Android Device - Chrome (393x873)",
                'user-agent': mobileBrowserUa
            },
            ip: testIp
        });

        await authController.signin(mock4.req, mock4.res);
        const status4 = mock4.getStatus();
        const data4 = mock4.getData();

        if (status4 !== 200 || !data4.accessToken) {
            throw new Error(`SECURITY FAILURE: User 2 login failed after User 1 binding was cleared! Status: ${status4}, Data: ${JSON.stringify(data4)}`);
        }
        console.log("✅ User 2 is now successfully LOGGED IN and bound to the device!");

        // Verify device is now bound to User 2
        const boundDeviceUser2 = await db.employee_devices.findOne({
            where: { staff_id: user2.staffid, is_active: true }
        });
        if (!boundDeviceUser2) {
            throw new Error("Device was not bound to User 2 in database!");
        }
        console.log(`✅ Device actively bound to User 2 in database (Staff ID: ${boundDeviceUser2.staff_id}).`);

        // ---------------------------------------------------------------------------------
        // STEP 5: User 1 now attempts login on the same phone -> BLOCKED!
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 5: User 1 now attempts login on the same phone in Mobile App ---");
        const mock5 = createMockReqRes({
            body: {
                email: user1.email,
                password: testPassword,
                forceLocal: true,
                is_mobile_app: true,
                client_type: 'mobile_app',
                deviceId: physicalMobileDeviceId,
                deviceName: "Samsung SM-S911B (Android 14)"
            },
            headers: {
                'x-is-mobile': 'true',
                'x-is-mobile-app': 'true',
                'x-device-id': physicalMobileDeviceId,
                'x-device-name': "Samsung SM-S911B (Android 14)",
                'user-agent': mobileAppUa
            },
            ip: testIp
        });

        await authController.signin(mock5.req, mock5.res);
        const status5 = mock5.getStatus();
        const data5 = mock5.getData();

        if (status5 !== 403 || !data5.deviceViolation) {
            throw new Error(`SECURITY FAILURE: User 1 was able to log in on a device now bound to User 2! Status: ${status5}, Data: ${JSON.stringify(data5)}`);
        }
        console.log("✅ User 1 was correctly BLOCKED from logging in because the phone is now actively bound to User 2.");

        // ---------------------------------------------------------------------------------
        // STEP 6: Desktop / Laptop browsers remain completely exempt and unblocked
        // ---------------------------------------------------------------------------------
        console.log("\n--- STEP 6: Desktop / Laptop browsers exemption verification ---");
        const desktopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const mockDesktop = createMockReqRes({
            body: {
                email: user1.email,
                password: testPassword,
                forceLocal: true,
                client_type: 'web'
            },
            headers: {
                'user-agent': desktopUa
            },
            ip: "192.168.1.50"
        });

        await authController.signin(mockDesktop.req, mockDesktop.res);
        const statusDesktop = mockDesktop.getStatus();
        const dataDesktop = mockDesktop.getData();

        if (statusDesktop !== 200 || !dataDesktop.accessToken) {
            throw new Error(`Desktop login was unexpectedly restricted! Status: ${statusDesktop}, Data: ${JSON.stringify(dataDesktop)}`);
        }
        console.log("✅ Desktop / Laptop browsers remain 100% exempt from device restrictions.");

        console.log("\n==========================================================================");
        console.log("🎉 ALL TESTS PASSED: Single-user mobile login enforcement works flawlessly!");
        console.log("==========================================================================");

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err);
        process.exit(1);
    } finally {
        await new Promise(r => setTimeout(r, 1500));
        await db.sequelize.close();
    }
}

runMobileLoginConflictTest();

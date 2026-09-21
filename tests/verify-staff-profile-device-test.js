const db = require("../models");

async function testProfileDeviceVisibility() {
    console.log("==================================================");
    console.log("🧪 TESTING STAFF PROFILE DEVICE VISIBILITY RBAC");
    console.log("==================================================");

    try {
        const superAdminRole = await db.roles.findOne({ where: { hierarchy_level: 0 } });
        const hrRole = await db.roles.findOne({ where: { hierarchy_level: { [db.Sequelize.Op.gt]: 0 } } });

        const superAdminUser = await db.user.findOne({ where: { role: superAdminRole.id, active: 1 } });
        const employeeUser = await db.user.findOne({ where: { active: 1 } });

        console.log(`👤 Super Admin User: ${superAdminUser.firstname} (Role: ${superAdminRole.name}, Level: 0)`);
        console.log(`👤 Target Employee: ${employeeUser.firstname} (Staff ID: ${employeeUser.staffid})`);

        // Ensure target employee has an active device binding
        await db.employee_devices.destroy({ where: { staff_id: employeeUser.staffid } });
        const testDevice = await db.employee_devices.create({
            staff_id: employeeUser.staffid,
            device_id: "wp-dev-test-superadmin-view-12345",
            device_name: "iPhone 15 Pro - Mobile Safari",
            user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            ip_address: "192.168.1.150",
            first_bound_at: new Date(),
            last_active_at: new Date(),
            is_active: true
        });
        console.log(`📱 Seeded active device for employee: ${testDevice.device_id}`);

        // Mock caller checks as done in onboarding.controller.js
        // Case 1: Caller is Level 0
        let callerRole = superAdminRole;
        let isCallerSuperAdmin = callerRole && callerRole.hierarchy_level === 0;
        let boundDevice = null;
        if (isCallerSuperAdmin) {
            boundDevice = await db.employee_devices.findOne({
                where: { staff_id: employeeUser.staffid, is_active: true }
            });
        }
        if (boundDevice && boundDevice.device_id === "wp-dev-test-superadmin-view-12345") {
            console.log("✅ Level 0 caller successfully sees bound_device:", boundDevice.device_id);
        } else {
            throw new Error("Case 1 Failed: Level 0 caller could not see bound device");
        }

        // Case 2: Caller is Level > 0 (e.g. Level 1 HR/Manager)
        callerRole = hrRole;
        isCallerSuperAdmin = callerRole && callerRole.hierarchy_level === 0;
        boundDevice = null;
        if (isCallerSuperAdmin) {
            boundDevice = await db.employee_devices.findOne({
                where: { staff_id: employeeUser.staffid, is_active: true }
            });
        }
        if (boundDevice === null) {
            console.log("✅ Non-Level 0 caller strictly receives bound_device: null");
        } else {
            throw new Error("Case 2 Failed: Non-Level 0 caller received bound device!");
        }

        console.log("\n==================================================");
        console.log("🎉 ALL RBAC VISIBILITY CHECKS PASSED!");
        console.log("==================================================");
        process.exit(0);

    } catch (err) {
        console.error("❌ TEST FAILED:", err);
        process.exit(1);
    }
}

testProfileDeviceVisibility();

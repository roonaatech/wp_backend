const db = require("../models");

async function updateRolePermissions() {
    try {
        console.log("Connecting to DB...");
        await db.sequelize.authenticate();
        console.log("✓ Connection established\n");

        const Role = db.roles;

        // Update Admin role - should have 'all' for active on-duty
        const adminRole = await Role.findOne({ where: { name: 'admin' } });
        if (adminRole) {
            await adminRole.update({ can_manage_active_onduty: 'all' });
            console.log("✓ Admin role updated: can_manage_active_onduty = 'all'");
        }

        // Update Leader role - should have 'all' for active on-duty
        const leaderRole = await Role.findOne({ where: { name: 'leader' } });
        if (leaderRole) {
            await leaderRole.update({ can_manage_active_onduty: 'all' });
            console.log("✓ Leader role updated: can_manage_active_onduty = 'all'");
        }

        // Update Manager role - should have 'subordinates' for active on-duty
        const managerRole = await Role.findOne({ where: { name: 'manager' } });
        if (managerRole) {
            await managerRole.update({ can_manage_active_onduty: 'subordinates' });
            console.log("✓ Manager role updated: can_manage_active_onduty = 'subordinates'");
        }

        // Update Human Resource role - should have 'all' for active on-duty
        const hrRole = await Role.findOne({ where: { name: 'human_resource' } });
        if (hrRole) {
            await hrRole.update({ can_manage_active_onduty: 'all' });
            console.log("✓ Human Resource role updated: can_manage_active_onduty = 'all'");
        }

        // Update Employee role - should have 'none' (default)
        const employeeRole = await Role.findOne({ where: { name: 'employee' } });
        if (employeeRole) {
            await employeeRole.update({ can_manage_active_onduty: 'none' });
            console.log("✓ Employee role updated: can_manage_active_onduty = 'none'");
        }

        console.log("\n✅ All roles updated successfully!");

        // Display current permissions
        console.log("\nCurrent Role Permissions for can_manage_active_onduty:");
        const allRoles = await Role.findAll({
            attributes: ['id', 'display_name', 'can_manage_active_onduty'],
            order: [['hierarchy_level', 'ASC']]
        });
        
        allRoles.forEach(role => {
            console.log(`   ${role.display_name}: ${role.can_manage_active_onduty}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

updateRolePermissions();

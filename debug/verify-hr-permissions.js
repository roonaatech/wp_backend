const db = require("../models");

async function verifyPermissions() {
    try {
        console.log("Connecting to DB...");
        await db.sequelize.authenticate();
        console.log("✓ Connection established\n");

        const Role = db.roles;
        const User = db.user;

        // Get HR role
        const hrRole = await Role.findOne({
            where: { name: 'human_resource' }
        });

        if (!hrRole) {
            console.log("❌ Human Resource role not found!");
            return;
        }

        console.log("📋 Human Resource Role Details:");
        console.log(`   Name: ${hrRole.name}`);
        console.log(`   Display Name: ${hrRole.display_name}`);
        console.log(`   ID: ${hrRole.id}\n`);

        console.log("📊 Permission Values:");
        console.log(`   can_approve_leave: ${hrRole.can_approve_leave}`);
        console.log(`   can_approve_onduty: ${hrRole.can_approve_onduty}`);
        console.log(`   can_manage_users: ${hrRole.can_manage_users}`);
        console.log(`   can_view_reports: ${hrRole.can_view_reports}`);
        console.log(`   can_access_webapp: ${hrRole.can_access_webapp}`);
        console.log(`   can_manage_leave_types: ${hrRole.can_manage_leave_types}`);
        console.log(`   can_manage_roles: ${hrRole.can_manage_roles}`);
        console.log(`   can_manage_email_settings: ${hrRole.can_manage_email_settings}\n`);

        // Get all HR users
        const hrUsers = await User.findAll({
            where: { role: hrRole.id },
            attributes: ['staffid', 'firstname', 'lastname', 'email', 'role']
        });

        console.log(`👥 HR Users (Total: ${hrUsers.length}):`);
        hrUsers.forEach(user => {
            console.log(`   - ${user.firstname} ${user.lastname} (ID: ${user.staffid})`);
        });

        // Check if HR user has subordinates
        if (hrUsers.length > 0) {
            const firstHRUser = hrUsers[0];
            console.log(`\n📈 Checking subordinates for ${firstHRUser.firstname} ${firstHRUser.lastname}:`);
            
            const subordinates = await User.findAll({
                where: { approving_manager_id: firstHRUser.staffid },
                attributes: ['staffid', 'firstname', 'lastname', 'role']
            });

            console.log(`   Found ${subordinates.length} subordinates`);
            subordinates.forEach(sub => {
                console.log(`   - ${sub.firstname} ${sub.lastname} (ID: ${sub.staffid})`);
            });
        }

        console.log("\n✅ Verification complete!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

verifyPermissions();

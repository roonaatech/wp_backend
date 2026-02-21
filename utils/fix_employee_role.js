/**
 * Fix Employee Role - Set can_access_webapp to false
 * This script fixes the security issue where Employee role has webapp access
 */

const db = require('../models');
const Role = db.roles;

async function fixEmployeeRole() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ Connected to database\n');

        // Find Employee role
        const employeeRole = await Role.findOne({ where: { name: 'employee' } });

        if (!employeeRole) {
            console.log('❌ Employee role not found!');
            process.exit(1);
        }

        console.log('📋 Current Employee role permissions:');
        console.log('   can_access_webapp:', employeeRole.can_access_webapp);
        console.log('   can_approve_leave:', employeeRole.can_approve_leave);
        console.log('   can_approve_onduty:', employeeRole.can_approve_onduty);

        if (employeeRole.can_access_webapp === false || employeeRole.can_access_webapp === 0) {
            console.log('\n✅ Employee role already has correct permissions (can_access_webapp: false)');
            await db.sequelize.close();
            process.exit(0);
        }

        console.log('\n⚠️  Employee role has INCORRECT permissions!');
        console.log('   can_access_webapp should be FALSE but is:', employeeRole.can_access_webapp);

        // Fix the role
        console.log('\n🔧 Fixing Employee role...');
        await employeeRole.update({
            can_access_webapp: false
        });

        console.log('✅ Employee role updated successfully!');

        // Verify the fix
        const updatedRole = await Role.findByPk(employeeRole.id);
        console.log('\n✅ Verified - can_access_webapp is now:', updatedRole.can_access_webapp);

        await db.sequelize.close();
        console.log('\n✨ Fix complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        await db.sequelize.close();
        process.exit(1);
    }
}

// Run the fix
console.log('🔧 Employee Role Permission Fix\n');
fixEmployeeRole();

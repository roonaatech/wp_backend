const db = require('../models');

async function fixRolePermissions() {
    try {
        console.log('Fixing role permissions...\n');

        // Get Admin role and update permissions
        const adminRole = await db.roles.findOne({ where: { name: 'admin' } });
        if (adminRole) {
            await adminRole.update({
                can_approve_leave: 'all',
                can_approve_onduty: 'all',
                can_manage_users: 'all',
                can_view_reports: 'all',
                can_access_webapp: true,
                can_manage_leave_types: true,
                can_manage_roles: true,
                can_manage_email_settings: true
            });
            console.log('✓ Admin role updated successfully');
        } else {
            console.log('✗ Admin role not found');
        }

        // Update Leader role
        const leaderRole = await db.roles.findOne({ where: { name: 'leader' } });
        if (leaderRole) {
            await leaderRole.update({
                can_approve_leave: 'all',
                can_approve_onduty: 'all',
                can_manage_users: 'subordinates',
                can_view_reports: 'all',
                can_access_webapp: true,
                can_manage_leave_types: false,
                can_manage_roles: false,
                can_manage_email_settings: false
            });
            console.log('✓ Leader role updated successfully');
        }

        // Update Manager role
        const managerRole = await db.roles.findOne({ where: { name: 'manager' } });
        if (managerRole) {
            await managerRole.update({
                can_approve_leave: 'subordinates',
                can_approve_onduty: 'subordinates',
                can_manage_users: 'subordinates',
                can_view_reports: 'subordinates',
                can_access_webapp: true,
                can_manage_leave_types: false,
                can_manage_roles: false,
                can_manage_email_settings: false
            });
            console.log('✓ Manager role updated successfully');
        }

        // Update Human Resource role
        const hrRole = await db.roles.findOne({ where: { name: 'human_resource' } });
        if (hrRole) {
            await hrRole.update({
                can_approve_leave: 'subordinates',
                can_approve_onduty: 'subordinates',
                can_manage_users: 'subordinates',
                can_view_reports: 'subordinates',
                can_access_webapp: true,
                can_manage_leave_types: false,
                can_manage_roles: false,
                can_manage_email_settings: false
            });
            console.log('✓ Human Resource role updated successfully');
        }

        // Update Staff role
        const staffRole = await db.roles.findOne({ where: { name: 'staff' } });
        if (staffRole) {
            await staffRole.update({
                can_approve_leave: 'none',
                can_approve_onduty: 'none',
                can_manage_users: 'none',
                can_view_reports: 'none',
                can_access_webapp: false,
                can_manage_leave_types: false,
                can_manage_roles: false,
                can_manage_email_settings: false
            });
            console.log('✓ Staff role updated successfully');
        }

        // Show all roles
        console.log('\n--- Current Role Permissions ---');
        const roles = await db.roles.findAll({ order: [['hierarchy_level', 'ASC']] });
        roles.forEach(r => {
            console.log(`${r.name} (level ${r.hierarchy_level}):`);
            console.log(`  can_manage_users: ${r.can_manage_users}`);
            console.log(`  can_approve_leave: ${r.can_approve_leave}`);
            console.log(`  can_approve_onduty: ${r.can_approve_onduty}`);
            console.log(`  can_view_reports: ${r.can_view_reports}`);
            console.log(`  can_access_webapp: ${r.can_access_webapp}`);
            console.log('');
        });

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

fixRolePermissions();

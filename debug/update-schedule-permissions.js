/**
 * Script to set default permissions for Schedule (can_manage_schedule) for all existing roles
 * Run once after migration: node debug/update-schedule-permissions.js
 * 
 * Default permissions:
 * - Admin: 'all'
 * - Leader: 'all'
 * - Human Resource: 'all'
 * - Manager: 'subordinates'
 * - Employee: 'none'
 */

const db = require("../models");
const Role = db.roles;

async function updateSchedulePermissions() {
    try {
        console.log('Starting schedule permission update...\n');

        // Define role permission mapping
        const rolePermissions = {
            'admin': 'all',
            'leader': 'all',
            'human_resource': 'all',
            'manager': 'subordinates',
            'employee': 'none'
        };

        // Update each role
        for (const [roleName, permission] of Object.entries(rolePermissions)) {
            const role = await Role.findOne({
                where: {
                    name: roleName
                }
            });

            if (role) {
                await role.update({ can_manage_schedule: permission });
                console.log(`✓ ${roleName.toUpperCase()}: can_manage_schedule = '${permission}'`);
            } else {
                console.log(`✗ Role '${roleName}' not found`);
            }
        }

        // Verify all roles have the permission set
        console.log('\n\nFinal verification:');
        const allRoles = await Role.findAll({
            attributes: ['id', 'name', 'display_name', 'can_manage_schedule'],
            order: [['id', 'ASC']]
        });

        console.log('\nAll roles with schedule permission:');
        allRoles.forEach(role => {
            console.log(`  ${role.display_name || role.name}: ${role.can_manage_schedule || 'NOT SET'}`);
        });

        console.log('\n✓ Schedule permission update completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error updating schedule permissions:', error);
        process.exit(1);
    }
}

updateSchedulePermissions();

const db = require('../models');

async function checkHRPermissions() {
    try {
        // Check HR role permissions
        const hrRole = await db.roles.findOne({ where: { name: 'human_resource' } });
        console.log('Human Resource Role ID:', hrRole?.id);
        console.log('Human Resource Permissions:');
        console.log('  can_manage_users:', hrRole?.can_manage_users);
        
        // Find users with HR role
        const hrUsers = await db.user.findAll({ 
            where: { role: hrRole?.id }, 
            attributes: ['staffid', 'firstname', 'lastname'] 
        });
        console.log('\nHR Users:', hrUsers.map(u => `${u.firstname} ${u.lastname} (ID:${u.staffid})`));
        
        // Find subordinates for each HR user
        for (const hrUser of hrUsers) {
            const subordinates = await db.user.findAll({ 
                where: { approving_manager_id: hrUser.staffid }, 
                attributes: ['staffid', 'firstname', 'lastname'] 
            });
            if (subordinates.length > 0) {
                console.log(`Subordinates of ${hrUser.firstname}:`, subordinates.map(s => `${s.firstname} ${s.lastname}`));
            } else {
                console.log(`Subordinates of ${hrUser.firstname}: NONE`);
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkHRPermissions();

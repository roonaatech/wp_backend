'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Clean up duplicate emails
        const [users] = await queryInterface.sequelize.query(
            "SELECT staffid, email, active FROM users ORDER BY email, active DESC, staffid ASC"
        );

        const emailGroups = {};
        for (const user of users) {
            const emailLower = user.email ? user.email.toLowerCase().trim() : '';
            if (!emailLower) continue;

            if (!emailGroups[emailLower]) {
                emailGroups[emailLower] = [];
            }
            emailGroups[emailLower].push(user);
        }

        for (const [email, group] of Object.entries(emailGroups)) {
            if (group.length > 1) {
                console.log(`Resolving duplicates for email: ${email}`);
                // Keep the first one (highest active, lowest staffid), modify the rest
                for (let i = 1; i < group.length; i++) {
                    const duplicateUser = group[i];
                    const staffid = duplicateUser.staffid;
                    const origEmail = duplicateUser.email;
                    
                    let newEmail;
                    if (origEmail.includes('@')) {
                        const parts = origEmail.split('@');
                        newEmail = `${parts[0]}+${staffid}@${parts[1]}`;
                    } else {
                        newEmail = `${origEmail}_dup_${staffid}`;
                    }
                    
                    console.log(`  - Updating user ID ${staffid} from "${origEmail}" to "${newEmail}"`);
                    await queryInterface.sequelize.query(
                        `UPDATE users SET email = :newEmail WHERE staffid = :staffid`,
                        {
                            replacements: { newEmail, staffid },
                            type: Sequelize.QueryTypes.UPDATE
                        }
                    );
                }
            }
        }

        // 2. Add unique constraint / index
        // Since we are using MySQL / SQLite, addIndex with unique: true works for both
        await queryInterface.addIndex('users', ['email'], {
            unique: true,
            name: 'users_email_unique'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('users', 'users_email_unique');
    }
};

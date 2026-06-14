const db = require("./models");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const cleanPart = (name) => {
    const letters = (name || '').trim().replace(/[^a-zA-Z]/g, '');
    if (letters.length > 0) {
        return letters.slice(0, 2).toLowerCase();
    }
    return (name || '').trim().slice(0, 2).toLowerCase();
};

const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

async function updatePasswords() {
    try {
        // Find all users except Super Admin (role ID 1)
        const users = await db.user.findAll({
            where: {
                role: {
                    [db.Sequelize.Op.ne]: 1
                }
            }
        });

        console.log(`Found ${users.length} users to update.`);

        const csvRows = [['FirstName', 'LastName', 'Email', 'TempPassword']];

        for (const user of users) {
            const fPart = cleanPart(user.firstname);
            const lPart = cleanPart(user.lastname);
            const currentYear = new Date().getFullYear();
            const tempPassword = `${fPart}${lPart}${currentYear}`;

            const hashedPassword = bcrypt.hashSync(tempPassword, 8);

            await user.update({
                password: hashedPassword,
                last_login: null // Reset last_login to force the password change flow
            });

            console.log(`Updated user ${user.email} (Temporary password: ${tempPassword})`);

            csvRows.push([
                user.firstname,
                user.lastname,
                user.email,
                tempPassword
            ]);
        }

        // Generate CSV file content
        const csvContent = csvRows
            .map(row => row.map(escapeCSV).join(','))
            .join('\n');

        const csvPath = path.join(__dirname, 'temp_passwords_export.csv');
        fs.writeFileSync(csvPath, csvContent, 'utf8');

        console.log(`All passwords updated successfully! Exported list to: ${csvPath}`);
        process.exit(0);
    } catch (err) {
        console.error("Error updating passwords:", err);
        process.exit(1);
    }
}

updatePasswords();

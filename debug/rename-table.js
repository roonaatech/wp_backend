const db = require('../models');
const queryInterface = db.sequelize.getQueryInterface();

async function run() {
    try {
        console.log('Renaming table tblstaff to users...');
        await queryInterface.renameTable('tblstaff', 'users');
        console.log('✅ Success: Renamed table.');
    } catch (error) {
        console.error('❌ Error renaming table:', error.message);
    }
    process.exit(0);
}

run();

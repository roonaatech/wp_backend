const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.uat explicitly
const envFile = path.resolve(__dirname, '..', '.env.uat');
if (fs.existsSync(envFile)) {
    console.log(`Loading environment from ${envFile}`);
    dotenv.config({ path: envFile });
} else {
    console.log('WARNING: .env.uat not found, falling back to .env');
    dotenv.config();
}

const db = require("../models");

async function diagnoseAndFix() {
    try {
        console.log("\n--- Database Diagnostics ---");
        console.log(`DB_HOST: ${process.env.DB_HOST}`);
        console.log(`DB_NAME: ${process.env.DB_NAME}`);
        console.log(`DB_USER: ${process.env.DB_USER}`);

        await db.sequelize.authenticate();
        console.log("✓ Connection established successfully.\n");

        const queryInterface = db.sequelize.getQueryInterface();

        // 1. Check if column exists
        console.log("Checking columns in 'roles' table...");
        const tableDescription = await queryInterface.describeTable('roles');
        const columns = Object.keys(tableDescription);
        const columnExists = columns.includes('can_manage_active_onduty');

        if (columnExists) {
            console.log("✓ Column 'can_manage_active_onduty' exists in table.");
            console.log("  Details:", tableDescription['can_manage_active_onduty']);
        } else {
            console.log("❌ Column 'can_manage_active_onduty' is MISSING.");

            console.log("\nAttempting to add the column manually...");
            const Sequelize = db.Sequelize;
            await queryInterface.addColumn('roles', 'can_manage_active_onduty', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none',
                comment: 'Manage active on-duty records - none=no access, subordinates=only subordinates, all=everyone'
            });
            console.log("✅ Column added successfully!");
        }

        // 2. Check SequelizeMeta
        console.log("\nChecking migration status in 'SequelizeMeta'...");
        const [results] = await db.sequelize.query("SELECT * FROM SequelizeMeta WHERE name = '20260127000004-add-active-onduty-permission.js'");
        if (results.length > 0) {
            console.log("✓ Migration record exists in SequelizeMeta.");
        } else {
            console.log("⚠️ Migration record MISSING in SequelizeMeta.");
            console.log("  Adding migration record to prevent future conflicts...");
            await db.sequelize.query("INSERT INTO SequelizeMeta (name) VALUES ('20260127000004-add-active-onduty-permission.js')");
            console.log("✅ Migration record added.");
        }

        console.log("\n--- Done ---");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error during diagnostics:", error);
        process.exit(1);
    }
}

diagnoseAndFix();

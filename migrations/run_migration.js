const db = require("../models");

async function addCCManagerColumn() {
    try {
        console.log("Adding cc_manager column to email_templates table...");

        await db.sequelize.query(`
            ALTER TABLE email_templates 
            ADD COLUMN cc_manager TINYINT(1) DEFAULT 0 
            COMMENT 'Whether to CC the manager on this email type'
        `);

        console.log("✅ Migration completed successfully!");
        console.log("The cc_manager column has been added to email_templates table.");

        process.exit(0);
    } catch (error) {
        if (error.message.includes("Duplicate column name")) {
            console.log("ℹ️  Column cc_manager already exists. Skipping migration.");
            process.exit(0);
        } else {
            console.error("❌ Migration failed:", error.message);
            process.exit(1);
        }
    }
}

addCCManagerColumn();

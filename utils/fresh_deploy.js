const db = require("../models");
const fs = require('fs');
const path = require('path');

async function freshDeploy() {
    try {
        console.log("🚀 Starting Fresh Deployment...");

        // 1. Sync Database (Creates tables from models)
        console.log("Step 1: Syncing models to database...");
        await db.sequelize.sync({ force: false });
        console.log("✅ Database synced.");

        // 2. Mark all migrations as completed
        console.log("Step 2: Marking migrations as completed...");

        // Ensure SequelizeMeta table exists
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS SequelizeMeta (
                name VARCHAR(255) NOT NULL PRIMARY KEY
            ) ENGINE=InnoDB;
        `);

        const migrationsDir = path.join(__dirname, '../migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js'))
            .sort((a, b) => a.localeCompare(b));

        for (const filename of migrationFiles) {
            const [exists] = await db.sequelize.query(
                `SELECT * FROM SequelizeMeta WHERE name = :name`,
                { replacements: { name: filename }, type: db.sequelize.QueryTypes.SELECT }
            );

            if (!exists) {
                await db.sequelize.query(
                    `INSERT INTO SequelizeMeta (name) VALUES (:name)`,
                    { replacements: { name: filename } }
                );
                console.log(`- Marked ${filename} as executed.`);
            }
        }
        console.log("✅ Migration history updated.");

        // 3. Run Seeders
        console.log("Step 3: Running seeders...");
        const seedRoles = require("./seed_roles");
        const seedLeaveTypes = require("./seed_leave_types");
        const seedTemplates = require("./seed_templates");

        console.log("\n--- Seeding Roles ---");
        await seedRoles();

        console.log("\n--- Seeding Leave Types ---");
        await seedLeaveTypes();

        console.log("\n--- Seeding Email Templates ---");
        await seedTemplates();

        console.log("\n✅ Fresh Deployment completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    }
}

freshDeploy();

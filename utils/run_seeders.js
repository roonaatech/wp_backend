const seedTemplates = require("./seed_templates");
const seedRoles = require("./seed_roles");
const seedLeaveTypes = require("./seed_leave_types");

async function run() {
    try {
        console.log("Starting Seeding Process...");

        console.log("\n--- Seeding Roles ---");
        await seedRoles();

        console.log("\n--- Seeding Leave Types ---");
        await seedLeaveTypes();

        console.log("\n--- Seeding Email Templates ---");
        await seedTemplates();

        console.log("\n✅ Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Seeding failed:", error);
        process.exit(1);
    }
}

run();

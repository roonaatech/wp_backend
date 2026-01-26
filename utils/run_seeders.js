const seedTemplates = require("./seed_templates");

async function run() {
    try {
        console.log("Starting Seeding Process...");
        await seedTemplates();
        console.log("✅ Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

run();

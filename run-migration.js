/**
 * Run this script directly with: node run-migration.js
 * It applies the work_mode ENUM fix without needing sequelize-cli.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: console.log,
        port: process.env.DB_PORT || 3306
    }
);

async function run() {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected');

        // Step 1: Widen ENUM to include both 'Regular' and 'Office'
        console.log('Step 1: Widening ENUM...');
        await sequelize.query(`
            ALTER TABLE users
            MODIFY COLUMN work_mode ENUM('Regular', 'Work from home', 'Hybrid', 'Office')
            NOT NULL DEFAULT 'Office'
        `);
        console.log('✅ Step 1 done');

        // Step 2: Migrate 'Regular' -> 'Office'
        console.log('Step 2: Migrating Regular -> Office...');
        const [result] = await sequelize.query(`
            UPDATE users SET work_mode = 'Office' WHERE work_mode = 'Regular'
        `);
        console.log(`✅ Step 2 done — rows updated: ${result.affectedRows ?? 'N/A'}`);

        // Step 3: Remove 'Regular' from ENUM
        console.log('Step 3: Finalizing ENUM...');
        await sequelize.query(`
            ALTER TABLE users
            MODIFY COLUMN work_mode ENUM('Office', 'Work from home', 'Hybrid')
            NOT NULL DEFAULT 'Office'
        `);
        console.log('✅ Step 3 done');

        // Verify
        const [rows] = await sequelize.query(`SHOW COLUMNS FROM users LIKE 'work_mode'`);
        console.log('✅ Final ENUM definition:', rows[0]?.Type);

        await sequelize.close();
        console.log('\n✅ Migration complete! work_mode ENUM now supports Office.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        await sequelize.close();
        process.exit(1);
    }
}

run();

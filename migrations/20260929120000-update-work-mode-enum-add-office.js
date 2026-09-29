'use strict';

/**
 * Migration: Update work_mode ENUM to include 'Office'
 * The original migration created the ENUM as ('Regular', 'Work from home', 'Hybrid').
 * The backend now normalizes to 'Office' instead of 'Regular', so we need to:
 * 1. Add 'Office' to the ENUM
 * 2. Migrate existing 'Regular' values to 'Office'
 * 3. Remove 'Regular' from the ENUM (by rebuilding it)
 *
 * MySQL requires a MODIFY COLUMN to change ENUM values.
 */
module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Step 1: Temporarily widen the ENUM to include both old and new values
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            MODIFY COLUMN work_mode ENUM('Regular', 'Work from home', 'Hybrid', 'Office')
            NOT NULL DEFAULT 'Office'
        `);

        // Step 2: Migrate all existing 'Regular' rows -> 'Office'
        await queryInterface.sequelize.query(`
            UPDATE users SET work_mode = 'Office' WHERE work_mode = 'Regular'
        `);

        // Step 3: Remove 'Regular' from the ENUM now that no rows use it
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            MODIFY COLUMN work_mode ENUM('Office', 'Work from home', 'Hybrid')
            NOT NULL DEFAULT 'Office'
        `);
    },

    down: async (queryInterface, Sequelize) => {
        // Reverse: widen, migrate back, narrow
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            MODIFY COLUMN work_mode ENUM('Regular', 'Work from home', 'Hybrid', 'Office')
            NOT NULL DEFAULT 'Regular'
        `);
        await queryInterface.sequelize.query(`
            UPDATE users SET work_mode = 'Regular' WHERE work_mode = 'Office'
        `);
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            MODIFY COLUMN work_mode ENUM('Regular', 'Work from home', 'Hybrid')
            NOT NULL DEFAULT 'Regular'
        `);
    }
};

'use strict';

module.exports = {
    up: async (queryInterface) => {
        // Backfill last_login from activity_logs:
        // For each user, set last_login to the most recent LOGIN event in activity_logs
        await queryInterface.sequelize.query(`
            UPDATE users u
            JOIN (
                SELECT admin_id, MAX(createdAt) AS last_login_at
                FROM activity_logs
                WHERE action = 'LOGIN'
                GROUP BY admin_id
            ) al ON u.staffid = al.admin_id
            SET u.last_login = al.last_login_at
            WHERE u.last_login IS NULL
        `);
    },

    down: async (queryInterface) => {
        // Cannot reliably undo a data backfill — clear the column
        await queryInterface.sequelize.query(`
            UPDATE users SET last_login = NULL
        `);
    }
};

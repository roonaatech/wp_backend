'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_view_birthdays) {
            await queryInterface.addColumn('roles', 'can_view_birthdays', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Can view staff birthdays on the dashboard and receive the birthday digest',
                after: 'can_manage_onboarding'
            });
        }

        // Backfill separately from the addColumn guard: `sync({ alter: true })`
        // can create the column ahead of this migration with everything false,
        // which would otherwise leave the permission granted to nobody.
        // Only seeds when no role holds it yet, so it never overrides choices
        // an administrator has already made on the Roles screen.
        const [rows] = await queryInterface.sequelize.query(
            `SELECT COUNT(*) AS granted FROM roles WHERE can_view_birthdays = true`
        );
        const granted = Number(rows[0].granted);

        if (granted === 0) {
            // Preserve existing access: the guard this replaces granted the
            // birthday dashboard to Human Resource level and above.
            await queryInterface.sequelize.query(`
                UPDATE roles
                SET can_view_birthdays = true
                WHERE hierarchy_level <= 2
            `);
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('roles', 'can_view_birthdays');
    }
};

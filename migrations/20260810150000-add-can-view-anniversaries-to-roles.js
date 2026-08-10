'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_view_anniversaries) {
            await queryInterface.addColumn('roles', 'can_view_anniversaries', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Can view staff work anniversaries on the dashboard and receive the anniversary digest',
                after: 'can_view_birthdays'
            });
        }

        // Only seeds when no role holds it yet, so it never overrides choices
        // an administrator has already made on the Roles screen.
        const [rows] = await queryInterface.sequelize.query(
            `SELECT COUNT(*) AS granted FROM roles WHERE can_view_anniversaries = true`
        );
        const granted = Number(rows[0].granted);

        if (granted === 0) {
            // Preserve existing access: grant the anniversary dashboard to Human Resource level and above (hierarchy <= 2)
            await queryInterface.sequelize.query(`
                UPDATE roles
                SET can_view_anniversaries = true
                WHERE hierarchy_level <= 2
            `);
        }
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('roles', 'can_view_anniversaries');
    }
};

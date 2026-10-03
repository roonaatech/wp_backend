'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_view_change_history) {
            await queryInterface.addColumn('roles', 'can_view_change_history', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none',
                comment: 'View staff change history - none=no access, subordinates=only subordinates, all=everyone'
            });

            // Grant 'all' to Super Admin and Admin (hierarchy_level <= 1) and HR (hierarchy_level <= 2 or can_manage_users = 'all')
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_view_change_history = 'all' 
                WHERE hierarchy_level <= 2 OR can_manage_users = 'all' OR can_view_users = 'all'
            `);

            // Grant 'subordinates' to Manager (hierarchy_level = 3 or can_manage_users = 'subordinates' or can_view_users = 'subordinates')
            await queryInterface.sequelize.query(`
                UPDATE roles 
                SET can_view_change_history = 'subordinates' 
                WHERE (hierarchy_level = 3 OR can_manage_users = 'subordinates' OR can_view_users = 'subordinates') 
                  AND can_view_change_history = 'none'
            `);
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('roles');
        if (tableInfo.can_view_change_history) {
            await queryInterface.removeColumn('roles', 'can_view_change_history');
            await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_roles_can_view_change_history";');
        }
    }
};

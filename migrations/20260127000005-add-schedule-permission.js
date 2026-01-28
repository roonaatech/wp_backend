module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('roles', 'can_manage_schedule', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'View schedule/calendar - none=no access, subordinates=only subordinates, all=everyone'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('roles', 'can_manage_schedule');
    }
};

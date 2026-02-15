module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('roles');
        if (!tableInfo.can_approve_timeoff) {
            await queryInterface.addColumn('roles', 'can_approve_timeoff', {
                type: Sequelize.ENUM('none', 'subordinates', 'all'),
                allowNull: false,
                defaultValue: 'none',
                comment: 'Approve time-off requests - none=no access, subordinates=only subordinates, all=everyone'
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('roles', 'can_approve_timeoff');
    }
};

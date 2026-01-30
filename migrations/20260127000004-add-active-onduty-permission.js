module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('roles', 'can_manage_active_onduty', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none',
            comment: 'Manage active on-duty records - none=no access, subordinates=only subordinates, all=everyone'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('roles', 'can_manage_active_onduty');
    }
};

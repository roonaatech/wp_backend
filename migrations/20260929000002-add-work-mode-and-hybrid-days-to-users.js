'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('users');

        if (!tableInfo.work_mode) {
            await queryInterface.addColumn('users', 'work_mode', {
                type: Sequelize.ENUM('Regular', 'Work from home', 'Hybrid'),
                allowNull: false,
                defaultValue: 'Regular',
                comment: 'Work mode: Regular (office), Work from home (remote), or Hybrid'
            });
        }

        if (!tableInfo.hybrid_office_days) {
            await queryInterface.addColumn('users', 'hybrid_office_days', {
                type: Sequelize.JSON,
                allowNull: true,
                comment: 'JSON array of days in week (e.g. ["Monday","Wednesday"]) employee attends office when work_mode is Hybrid'
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('users');
        if (tableInfo.hybrid_office_days) {
            await queryInterface.removeColumn('users', 'hybrid_office_days');
        }
        if (tableInfo.work_mode) {
            await queryInterface.removeColumn('users', 'work_mode');
        }
    }
};

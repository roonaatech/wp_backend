'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('service_accounts');

        if (!tableInfo.context_path) {
            await queryInterface.addColumn('service_accounts', 'context_path', {
                type: Sequelize.STRING(255),
                allowNull: true,
                defaultValue: null,
                comment: 'Optional route/context path to navigate to after service account login (e.g. /dashboard)'
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('service_accounts');
        if (tableInfo.context_path) {
            await queryInterface.removeColumn('service_accounts', 'context_path');
        }
    }
};

'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('users');

        if (!tableInfo.employment_type) {
            await queryInterface.addColumn('users', 'employment_type', {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'Full-time',
                comment: 'Employment type: Full-time or Part-time'
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('users');
        if (tableInfo.employment_type) {
            await queryInterface.removeColumn('users', 'employment_type');
        }
    }
};

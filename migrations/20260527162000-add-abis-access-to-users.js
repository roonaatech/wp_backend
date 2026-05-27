'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'abis_access', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this user has access to ABIS PHP application'
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('users', 'abis_access');
    }
};

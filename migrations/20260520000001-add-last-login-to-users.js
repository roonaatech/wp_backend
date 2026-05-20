'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'last_login', {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
            comment: 'Timestamp of the user\'s most recent successful login'
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('users', 'last_login');
    }
};

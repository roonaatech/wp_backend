'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableDescription = await queryInterface.describeTable('users');
        if (!tableDescription.is_temporary_password) {
            await queryInterface.addColumn('users', 'is_temporary_password', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                comment: 'Whether the current password is a temporary generated password'
            });
        }
    },

    down: async (queryInterface) => {
        const tableDescription = await queryInterface.describeTable('users');
        if (tableDescription.is_temporary_password) {
            await queryInterface.removeColumn('users', 'is_temporary_password');
        }
    }
};

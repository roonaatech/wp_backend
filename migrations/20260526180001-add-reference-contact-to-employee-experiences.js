'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('employee_experiences', 'reference_contact', {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: null,
            comment: 'Reference contact name and phone number for this employment'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('employee_experiences', 'reference_contact');
    }
};

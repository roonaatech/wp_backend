'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('employee_profiles', 'date_of_joining', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: 'date_of_birth'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('employee_profiles', 'date_of_joining');
  }
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'secondary_email', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Secondary/personal email for receiving notifications'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'secondary_email');
  }
};

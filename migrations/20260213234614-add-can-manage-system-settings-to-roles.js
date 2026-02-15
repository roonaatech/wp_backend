'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('roles', 'can_manage_system_settings', {
      type: Sequelize.ENUM('none', 'all'),
      allowNull: false,
      defaultValue: 'none',
      comment: 'Manage system settings - none=no access, all=access'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('roles', 'can_manage_system_settings');
  }
};

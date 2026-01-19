'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('tblstaff', 'users');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('users', 'tblstaff');
  }
};

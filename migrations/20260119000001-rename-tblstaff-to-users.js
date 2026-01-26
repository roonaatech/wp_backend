'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // No-op: table already named 'users'
    return Promise.resolve();
  },

  down: async (queryInterface, Sequelize) => {
    // No-op
    return Promise.resolve();
  }
};

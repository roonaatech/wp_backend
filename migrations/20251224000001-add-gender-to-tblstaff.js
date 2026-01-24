'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // No-op: gender column already exists
    return Promise.resolve();
  },
  down: async (queryInterface, Sequelize) => {
    // No-op
    return Promise.resolve();
  }
};

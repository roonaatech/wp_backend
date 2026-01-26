'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // No-op: gender_restriction column already exists
    return Promise.resolve();
  },
  down: async (queryInterface, Sequelize) => {
    // No-op
    return Promise.resolve();
  }
};

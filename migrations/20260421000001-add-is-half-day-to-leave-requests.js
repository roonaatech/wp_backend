'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column exists first to be safe
    const tableDesc = await queryInterface.describeTable('leave_requests');
    if (!tableDesc.is_half_day) {
      await queryInterface.addColumn('leave_requests', 'is_half_day', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('leave_requests');
    if (tableDesc.is_half_day) {
      await queryInterface.removeColumn('leave_requests', 'is_half_day');
    }
  }
};

'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leave_types', 'gender_restriction', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('leave_types', 'gender_restriction');
  }
};

'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tblstaff', 'gender', {
      type: Sequelize.ENUM('Male', 'Female', 'Transgender'),
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tblstaff', 'gender');
  }
};

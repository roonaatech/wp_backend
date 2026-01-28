'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add can_view_activities column with ENUM type
    await queryInterface.addColumn('roles', 'can_view_activities', {
      type: Sequelize.ENUM('none', 'subordinates', 'all'),
      allowNull: false,
      defaultValue: 'none',
      after: 'can_manage_schedule'
    });

    // Update default roles with appropriate permissions
    // Admin (id=1) and Leader (id=2) should have 'all' access
    await queryInterface.sequelize.query(`
      UPDATE roles 
      SET can_view_activities = 'all' 
      WHERE id IN (1, 2)
    `);

    // HR (id=5) should have 'all' access
    await queryInterface.sequelize.query(`
      UPDATE roles 
      SET can_view_activities = 'all' 
      WHERE id = 5
    `);

    // Manager (id=3) should have 'subordinates' access
    await queryInterface.sequelize.query(`
      UPDATE roles 
      SET can_view_activities = 'subordinates' 
      WHERE id = 3
    `);

    console.log('Added can_view_activities permission to roles table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('roles', 'can_view_activities');
    // Clean up the ENUM type
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_roles_can_view_activities";`);
  }
};

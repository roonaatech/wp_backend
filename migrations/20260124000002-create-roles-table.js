'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      hierarchy_level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Lower number = higher authority. 0=highest, 999=lowest'
      },
      can_approve_leave: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_approve_onduty: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_manage_users: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_manage_leave_types: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_view_reports: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Insert default roles matching current system (1=Admin, 2=Manager, 3=Leader, 4=Employee)
    await queryInterface.bulkInsert('roles', [
      {
        id: 1,
        name: 'admin',
        display_name: 'Admin',
        description: 'Full system access with all permissions',
        hierarchy_level: 0,
        can_approve_leave: true,
        can_approve_onduty: true,
        can_manage_users: true,
        can_manage_leave_types: true,
        can_view_reports: true,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: 'manager',
        display_name: 'Manager',
        description: 'Can manage team members and approve requests',
        hierarchy_level: 1,
        can_approve_leave: true,
        can_approve_onduty: true,
        can_manage_users: false,
        can_manage_leave_types: false,
        can_view_reports: true,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        name: 'leader',
        display_name: 'Leader',
        description: 'Team lead with limited approval permissions',
        hierarchy_level: 2,
        can_approve_leave: true,
        can_approve_onduty: true,
        can_manage_users: false,
        can_manage_leave_types: false,
        can_view_reports: true,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        name: 'employee',
        display_name: 'Employee',
        description: 'Standard employee with basic access',
        hierarchy_level: 3,
        can_approve_leave: false,
        can_approve_onduty: false,
        can_manage_users: false,
        can_manage_leave_types: false,
        can_view_reports: false,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('roles');
  }
};

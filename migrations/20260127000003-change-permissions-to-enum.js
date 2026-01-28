'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Change boolean permission columns to ENUM with 'none', 'subordinates', 'all' values
        // For hierarchical permissions
        
        // can_approve_leave: boolean -> enum
        await queryInterface.changeColumn('roles', 'can_approve_leave', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none'
        });

        // can_approve_onduty: boolean -> enum
        await queryInterface.changeColumn('roles', 'can_approve_onduty', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none'
        });

        // can_manage_users: boolean -> enum
        await queryInterface.changeColumn('roles', 'can_manage_users', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none'
        });

        // can_view_reports: boolean -> enum
        await queryInterface.changeColumn('roles', 'can_view_reports', {
            type: Sequelize.ENUM('none', 'subordinates', 'all'),
            allowNull: false,
            defaultValue: 'none'
        });

        // Update existing data - convert true to 'all', false to 'none'
        // This handles any existing roles that had boolean values
        await queryInterface.sequelize.query(`
            UPDATE roles SET 
                can_approve_leave = CASE WHEN can_approve_leave = '1' OR can_approve_leave = 'true' THEN 'all' ELSE 'none' END,
                can_approve_onduty = CASE WHEN can_approve_onduty = '1' OR can_approve_onduty = 'true' THEN 'all' ELSE 'none' END,
                can_manage_users = CASE WHEN can_manage_users = '1' OR can_manage_users = 'true' THEN 'all' ELSE 'none' END,
                can_view_reports = CASE WHEN can_view_reports = '1' OR can_view_reports = 'true' THEN 'all' ELSE 'none' END
        `);
    },

    async down(queryInterface, Sequelize) {
        // Revert back to boolean
        await queryInterface.changeColumn('roles', 'can_approve_leave', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });

        await queryInterface.changeColumn('roles', 'can_approve_onduty', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });

        await queryInterface.changeColumn('roles', 'can_manage_users', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });

        await queryInterface.changeColumn('roles', 'can_view_reports', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }
};

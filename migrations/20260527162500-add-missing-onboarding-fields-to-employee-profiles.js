'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add date_of_birth
        await queryInterface.addColumn('employee_profiles', 'date_of_birth', {
            type: Sequelize.DATEONLY,
            allowNull: true,
            defaultValue: null
        });

        // Add image_path
        await queryInterface.addColumn('employee_profiles', 'image_path', {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: null,
            comment: 'Path to employee profile photo'
        });

        // Add onboarding_status
        await queryInterface.addColumn('employee_profiles', 'onboarding_status', {
            type: Sequelize.ENUM('Completed', 'Pending_Candidate', 'Pending_HR_Approval'),
            defaultValue: 'Completed',
            allowNull: false
        });

        // Add onboarding_token
        await queryInterface.addColumn('employee_profiles', 'onboarding_token', {
            type: Sequelize.STRING(100),
            allowNull: true,
            defaultValue: null
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('employee_profiles', 'date_of_birth');
        await queryInterface.removeColumn('employee_profiles', 'image_path');
        await queryInterface.removeColumn('employee_profiles', 'onboarding_status');
        await queryInterface.removeColumn('employee_profiles', 'onboarding_token');
    }
};

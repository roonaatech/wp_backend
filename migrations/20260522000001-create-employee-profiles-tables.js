'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create employee_profiles
    await queryInterface.createTable('employee_profiles', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      staff_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'staffid' },
        onDelete: 'CASCADE'
      },
      birthplace: { type: Sequelize.STRING(100), allowNull: true },
      height_weight: { type: Sequelize.STRING(50), allowNull: true },
      blood_group: { type: Sequelize.STRING(10), allowNull: true },
      age: { type: Sequelize.INTEGER, allowNull: true },
      has_disability: { type: Sequelize.BOOLEAN, defaultValue: false },
      disability_details: { type: Sequelize.TEXT, allowNull: true },
      marital_status: { type: Sequelize.STRING(20), allowNull: true },
      no_of_children: { type: Sequelize.INTEGER, defaultValue: 0 },
      hobbies: { type: Sequelize.TEXT, allowNull: true },
      nationality: { type: Sequelize.STRING(50), allowNull: true },
      religion: { type: Sequelize.STRING(50), allowNull: true },
      present_address: { type: Sequelize.TEXT, allowNull: true },
      present_contact_no: { type: Sequelize.STRING(20), allowNull: true },
      permanent_address: { type: Sequelize.TEXT, allowNull: true },
      permanent_contact_no: { type: Sequelize.STRING(20), allowNull: true },
      father_name: { type: Sequelize.STRING(100), allowNull: true },
      father_age: { type: Sequelize.INTEGER, allowNull: true },
      father_occupation: { type: Sequelize.STRING(100), allowNull: true },
      father_work_status: { type: Sequelize.STRING(50), allowNull: true },
      mother_name: { type: Sequelize.STRING(100), allowNull: true },
      mother_age: { type: Sequelize.INTEGER, allowNull: true },
      mother_occupation: { type: Sequelize.STRING(100), allowNull: true },
      bank_account_number: { type: Sequelize.STRING(50), allowNull: true },
      bank_ifsc_code: { type: Sequelize.STRING(20), allowNull: true },
      bank_name_address: { type: Sequelize.TEXT, allowNull: true },
      consent_given: { type: Sequelize.BOOLEAN, defaultValue: false },
      signature_name: { type: Sequelize.STRING(100), allowNull: true },
      signature_path: { type: Sequelize.STRING(255), allowNull: true },
      signature_date: { type: Sequelize.DATE, allowNull: true },
      onboarding_place: { type: Sequelize.STRING(100), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // 2. Create employee_educations
    await queryInterface.createTable('employee_educations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      staff_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'staffid' },
        onDelete: 'CASCADE'
      },
      qualification: { type: Sequelize.STRING(100), allowNull: false },
      specialization: { type: Sequelize.STRING(100), allowNull: true },
      grade: { type: Sequelize.STRING(20), allowNull: true },
      university_city: { type: Sequelize.STRING(150), allowNull: true },
      year_of_completion: { type: Sequelize.INTEGER, allowNull: true }
    });

    // 3. Create employee_experiences
    await queryInterface.createTable('employee_experiences', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      staff_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'staffid' },
        onDelete: 'CASCADE'
      },
      post_held: { type: Sequelize.STRING(100), allowNull: false },
      department_function: { type: Sequelize.STRING(100), allowNull: true },
      company_name: { type: Sequelize.STRING(150), allowNull: false },
      city: { type: Sequelize.STRING(100), allowNull: true },
      tenure: { type: Sequelize.STRING(50), allowNull: true }
    });

    // 4. Create employee_family_members
    await queryInterface.createTable('employee_family_members', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      staff_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'staffid' },
        onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING(100), allowNull: false },
      relationship: { type: Sequelize.STRING(50), allowNull: false },
      work_status: { type: Sequelize.STRING(100), allowNull: true },
      educational_status: { type: Sequelize.STRING(100), allowNull: true },
      marital_status: { type: Sequelize.STRING(50), allowNull: true },
      residing_in: { type: Sequelize.STRING(100), allowNull: true }
    });

    // 5. Create employee_documents
    await queryInterface.createTable('employee_documents', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      staff_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'staffid' },
        onDelete: 'CASCADE'
      },
      document_type: { type: Sequelize.STRING(50), allowNull: false },
      file_name: { type: Sequelize.STRING(255), allowNull: false },
      file_path: { type: Sequelize.STRING(255), allowNull: false },
      file_size: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('employee_documents');
    await queryInterface.dropTable('employee_family_members');
    await queryInterface.dropTable('employee_experiences');
    await queryInterface.dropTable('employee_educations');
    await queryInterface.dropTable('employee_profiles');
  }
};

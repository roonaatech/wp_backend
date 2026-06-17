module.exports = (sequelize, Sequelize) => {
    const EmployeeProfile = sequelize.define("employee_profiles", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: 'Links 1-to-1 directly to users.staffid'
        },
        // Personal Details
        birthplace: { type: Sequelize.STRING(100), allowNull: true },
        height_weight: { type: Sequelize.STRING(50), allowNull: true },
        blood_group: { type: Sequelize.STRING(10), allowNull: true },
        date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
        date_of_joining: { type: Sequelize.DATEONLY, allowNull: true },
        age: { type: Sequelize.INTEGER, allowNull: true },
        has_disability: { type: Sequelize.BOOLEAN, defaultValue: false },
        disability_details: { type: Sequelize.TEXT, allowNull: true },
        marital_status: { type: Sequelize.STRING(20), allowNull: true },
        no_of_children: { type: Sequelize.INTEGER, defaultValue: 0 },
        hobbies: { type: Sequelize.TEXT, allowNull: true },
        nationality: { type: Sequelize.STRING(50), allowNull: true },
        religion: { type: Sequelize.STRING(50), allowNull: true },
        
        // Addresses
        present_address: { type: Sequelize.TEXT, allowNull: true },
        present_contact_no: { type: Sequelize.STRING(20), allowNull: true },
        permanent_address: { type: Sequelize.TEXT, allowNull: true },
        permanent_contact_no: { type: Sequelize.STRING(20), allowNull: true },

        // Family Details (Parents)
        father_name: { type: Sequelize.STRING(100), allowNull: true },
        father_age: { type: Sequelize.INTEGER, allowNull: true },
        father_occupation: { type: Sequelize.STRING(100), allowNull: true },
        father_work_status: { type: Sequelize.STRING(50), allowNull: true },
        mother_name: { type: Sequelize.STRING(100), allowNull: true },
        mother_age: { type: Sequelize.INTEGER, allowNull: true },
        mother_occupation: { type: Sequelize.STRING(100), allowNull: true },

        // Bank Details
        bank_account_number: { type: Sequelize.STRING(50), allowNull: true },
        bank_ifsc_code: { type: Sequelize.STRING(20), allowNull: true },
        bank_name_address: { type: Sequelize.TEXT, allowNull: true },

        // Consent & Signature
        consent_given: { type: Sequelize.BOOLEAN, defaultValue: false },
        signature_name: { type: Sequelize.STRING(100), allowNull: true },
        signature_path: { type: Sequelize.STRING(255), allowNull: true, comment: 'Path to digital signature image' },
        image_path: { type: Sequelize.STRING(255), allowNull: true, comment: 'Path to employee profile photo' },
        signature_date: { type: Sequelize.DATE, allowNull: true },
        onboarding_place: { type: Sequelize.STRING(100), allowNull: true },

        // Onboarding Status
        onboarding_status: { 
            type: Sequelize.ENUM('Completed', 'Pending_Candidate', 'Pending_HR_Approval'), 
            defaultValue: 'Completed' 
        },
        onboarding_token: { 
            type: Sequelize.STRING(100), 
            allowNull: true 
        }
    }, {
        tableName: 'employee_profiles',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['staff_id']
            }
        ]
    });

    return EmployeeProfile;
};

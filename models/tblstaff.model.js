module.exports = (sequelize, Sequelize) => {
    const TblStaff = sequelize.define("tblstaff", {
        staffid: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true // Assuming auto-increment, though user schema said 'int NOT NULL' without auto_increment explicitly, but usually it is.
        },
        email: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        firstname: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        lastname: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        facebook: {
            type: Sequelize.TEXT('medium')
        },
        linkedin: {
            type: Sequelize.TEXT('medium')
        },
        phonenumber: {
            type: Sequelize.STRING(30)
        },
        skype: {
            type: Sequelize.STRING(50)
        },
        password: {
            type: Sequelize.STRING(250),
            allowNull: false
        },
        datecreated: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        },
        profile_image: {
            type: Sequelize.STRING(191)
        },
        last_ip: {
            type: Sequelize.STRING(40)
        },
        last_login: {
            type: Sequelize.DATE
        },
        last_activity: {
            type: Sequelize.DATE
        },
        last_password_change: {
            type: Sequelize.DATE
        },
        new_pass_key: {
            type: Sequelize.STRING(32)
        },
        new_pass_key_requested: {
            type: Sequelize.DATE
        },
        admin: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        role: {
            type: Sequelize.INTEGER
        },
        active: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        default_language: {
            type: Sequelize.STRING(40)
        },
        direction: {
            type: Sequelize.STRING(3)
        },
        media_path_slug: {
            type: Sequelize.STRING(191)
        },
        is_not_staff: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        hourly_rate: {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        two_factor_auth_enabled: {
            type: Sequelize.BOOLEAN, // bit(1)
            defaultValue: false
        },
        two_factor_auth_code: {
            type: Sequelize.STRING(100)
        },
        gender: {
            type: Sequelize.ENUM('Male', 'Female', 'Transgender'),
            allowNull: true
        },
        // two_factor_auth_secret: {
        //     type: Sequelize.STRING(250)
        // },
        two_factor_auth_code_requested: {
            type: Sequelize.DATE
        },
        email_signature: {
            type: Sequelize.TEXT
        },
        google_auth_secret: {
            type: Sequelize.TEXT
        },
        reporting_to: {
            type: Sequelize.INTEGER
        },
        approving_manager_id: {
            type: Sequelize.INTEGER,
            comment: 'For managers: their approving admin. For employees: their reporting manager.'
        },
        designation: {
            type: Sequelize.INTEGER
        },
        c_id: {
            type: Sequelize.INTEGER
        }
    }, {
        tableName: 'tblstaff',
        timestamps: false // The schema has specific date fields, so we disable default createdAt/updatedAt
    });

    return TblStaff;
};

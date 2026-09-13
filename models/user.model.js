module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("users", {
        staffid: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userid: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'External System User ID (e.g. from PHP App)'
        },
        firstname: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        lastname: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        email: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: 'users_email_unique'
        },
        secondary_email: {
            type: Sequelize.STRING(100),
            allowNull: true,
            comment: 'Secondary/personal email for receiving notifications'
        },
        password: {
            type: Sequelize.STRING(250),
            allowNull: false
        },
        role: {
            type: Sequelize.INTEGER
        },
        active: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        admin: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        approving_manager_id: {
            type: Sequelize.INTEGER,
            comment: 'For managers: their approving admin. For employees: their reporting manager.'
        },
        gender: {
            type: Sequelize.ENUM('Male', 'Female', 'Transgender'),
            allowNull: true
        },
        datecreated: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        },
        last_login: {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
            comment: 'Timestamp of the user\'s most recent successful login'
        },
        abis_access: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this user has access to ABIS PHP application'
        },
        face_descriptor: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
            comment: 'Stringified JSON array representing 128-dimensional face embedding'
        },
        face_descriptor_left: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
            comment: 'Stringified JSON array representing left profile face embedding'
        },
        face_descriptor_right: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
            comment: 'Stringified JSON array representing right profile face embedding'
        },
        face_registered_at: {
            type: Sequelize.DATE,
            allowNull: true
        },
        face_image_path: {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Path to the face capture used for face registration (kept separate from the profile photo)'
        }
    }, {
        tableName: 'users',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['email'],
                name: 'users_email_unique'
            }
        ]
    });

    return User;
};

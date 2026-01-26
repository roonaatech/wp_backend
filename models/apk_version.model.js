module.exports = (sequelize, Sequelize) => {
    const ApkVersion = sequelize.define("apk_versions", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        version: {
            type: Sequelize.STRING(50),
            allowNull: false
        },
        filename: {
            type: Sequelize.STRING(255),
            allowNull: false
        },
        filepath: {
            type: Sequelize.STRING(255),
            allowNull: false
        },
        upload_date: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        },
        uploaded_by: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        is_visible: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        },
        release_notes: {
            type: Sequelize.TEXT,
            allowNull: true
        }
    });

    return ApkVersion;
};

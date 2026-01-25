const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
    const EmailTemplate = sequelize.define("email_template", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        slug: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
            comment: "Unique identifier for the template system-wise (e.g., 'leave_applied')",
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        subject: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        variables_hint: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "Comma separated list of available variables for this template",
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        cc_manager: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: "Whether to CC the manager on this email type",
        },
    });

    return EmailTemplate;
};

const { DataTypes } = require("sequelize");

module.exports = (sequelize, Sequelize) => {
  const EmailConfig = sequelize.define("email_config", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    provider_type: {
      type: DataTypes.ENUM("SMTP", "API"),
      defaultValue: "SMTP",
    },
    host: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    secure: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    auth_user: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    auth_pass: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    from_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    from_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  return EmailConfig;
};

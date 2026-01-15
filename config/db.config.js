require('dotenv').config(); // Make sure environment variables are loaded

const development = {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || "127.0.0.1",
    dialect: "mysql",
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

module.exports = {
    development,
    // Your application likely uses the config directly, so we keep the original structure as well
    HOST: development.host,
    USER: development.username,
    PASSWORD: development.password,
    DB: development.database,
    dialect: development.dialect,
    pool: development.pool
};

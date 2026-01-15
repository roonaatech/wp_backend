const dbConfig = require("../config/db.config.js");
const Sequelize = require("sequelize");

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    operatorsAliases: false,

    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
    }
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.tblstaff = require("./tblstaff.model.js")(sequelize, Sequelize);
db.leave_types = require("./leave_type.model.js")(sequelize, Sequelize);
db.leave_requests = require("./leave_request.model.js")(sequelize, Sequelize);
db.on_duty_logs = require("./on_duty_log.model.js")(sequelize, Sequelize);
db.approvals = require("./approval.model.js")(sequelize, Sequelize);
db.activity_logs = require("./activity_log.model.js")(sequelize, Sequelize);

// Associations
db.tblstaff.hasMany(db.leave_requests, { foreignKey: 'staff_id' });
db.leave_requests.belongsTo(db.tblstaff, { foreignKey: 'staff_id' });

// Leave approver relationship
db.leave_requests.belongsTo(db.tblstaff, { foreignKey: 'manager_id', as: 'approver' });

db.tblstaff.hasMany(db.on_duty_logs, { foreignKey: 'staff_id' });
db.on_duty_logs.belongsTo(db.tblstaff, { foreignKey: 'staff_id', targetKey: 'staffid' });

// On-duty approver relationship
db.on_duty_logs.belongsTo(db.tblstaff, { foreignKey: 'manager_id', as: 'approver' });

// db.attendance_logs.hasOne(db.approvals, { foreignKey: "attendance_log_id", as: "approval" });
// db.approvals.belongsTo(db.attendance_logs, { foreignKey: "attendance_log_id" });

db.on_duty_logs.hasOne(db.approvals, { foreignKey: "on_duty_log_id", as: "approval" });
db.approvals.belongsTo(db.on_duty_logs, { foreignKey: "on_duty_log_id" });

db.tblstaff.hasMany(db.approvals, { foreignKey: "manager_id" });
db.approvals.belongsTo(db.tblstaff, { foreignKey: "manager_id", as: "manager" });

// Activity Log associations
db.tblstaff.hasMany(db.activity_logs, { foreignKey: 'admin_id', as: 'admin_activities' });
db.activity_logs.belongsTo(db.tblstaff, { foreignKey: 'admin_id', as: 'admin' });

db.tblstaff.hasMany(db.activity_logs, { foreignKey: 'affected_user_id', as: 'affected_activities' });
db.activity_logs.belongsTo(db.tblstaff, { foreignKey: 'affected_user_id', as: 'affected_user' });

module.exports = db;

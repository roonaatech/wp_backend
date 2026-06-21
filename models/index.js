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

db.user = require("./user.model.js")(sequelize, Sequelize);
db.roles = require("./role.model.js")(sequelize, Sequelize);
db.leave_types = require("./leave_type.model.js")(sequelize, Sequelize);
db.leave_requests = require("./leave_request.model.js")(sequelize, Sequelize);
db.on_duty_logs = require("./on_duty_log.model.js")(sequelize, Sequelize);
db.approvals = require("./approval.model.js")(sequelize, Sequelize);
db.activity_logs = require("./activity_log.model.js")(sequelize, Sequelize);
db.apk_versions = require("./apk_version.model.js")(sequelize, Sequelize);
db.attendance_logs = require("./attendance_log.model.js")(sequelize, Sequelize);

// Associations
db.user.belongsTo(db.roles, { foreignKey: 'role', as: 'role_info' });
db.roles.hasMany(db.user, { foreignKey: 'role' });

db.user.hasMany(db.leave_requests, { foreignKey: 'staff_id' });
db.leave_requests.belongsTo(db.user, { foreignKey: 'staff_id', as: 'user' });

// Leave approver relationship
db.leave_requests.belongsTo(db.user, { foreignKey: 'manager_id', as: 'approver' });

db.user.hasMany(db.on_duty_logs, { foreignKey: 'staff_id' });
db.on_duty_logs.belongsTo(db.user, { foreignKey: 'staff_id', targetKey: 'staffid', as: 'user' });

// On-duty approver relationship
db.on_duty_logs.belongsTo(db.user, { foreignKey: 'manager_id', as: 'approver' });

db.attendance_logs.hasOne(db.approvals, { foreignKey: "attendance_log_id", as: "approval" });
db.approvals.belongsTo(db.attendance_logs, { foreignKey: "attendance_log_id" });

db.on_duty_logs.hasOne(db.approvals, { foreignKey: "on_duty_log_id", as: "approval" });
db.approvals.belongsTo(db.on_duty_logs, { foreignKey: "on_duty_log_id" });

db.user.hasMany(db.approvals, { foreignKey: "manager_id" });
db.approvals.belongsTo(db.user, { foreignKey: "manager_id", as: "manager" });

// Activity Log associations
db.user.hasMany(db.activity_logs, { foreignKey: 'admin_id', as: 'admin_activities' });
db.activity_logs.belongsTo(db.user, { foreignKey: 'admin_id', as: 'admin' });

db.user.hasMany(db.activity_logs, { foreignKey: 'affected_user_id', as: 'affected_activities' });
db.activity_logs.belongsTo(db.user, { foreignKey: 'affected_user_id', as: 'affected_user' });

// Apk Version associations
db.user.hasMany(db.apk_versions, { foreignKey: 'uploaded_by', as: 'uploaded_apks' });
db.apk_versions.belongsTo(db.user, { foreignKey: 'uploaded_by', as: 'uploader' });

// Email Module Models
db.email_config = require("./email_config.model.js")(sequelize, Sequelize);
db.email_templates = require("./email_template.model.js")(sequelize, Sequelize);

// UserLeaveType associations
db.user_leave_types = require("./user_leave_type.model.js")(sequelize, Sequelize);
db.user.hasMany(db.user_leave_types, { foreignKey: 'user_id' });
db.user_leave_types.belongsTo(db.user, { foreignKey: 'user_id' });
db.leave_types.hasMany(db.user_leave_types, { foreignKey: 'leave_type_id' });
db.user_leave_types.belongsTo(db.leave_types, { foreignKey: 'leave_type_id', as: 'leave_type' });

// Time Off Requests
db.time_off_requests = require("./time_off_request.model.js")(sequelize, Sequelize);
db.user.hasMany(db.time_off_requests, { foreignKey: 'staff_id' });
db.time_off_requests.belongsTo(db.user, { foreignKey: 'staff_id', as: 'user' });
db.time_off_requests.belongsTo(db.user, { foreignKey: 'manager_id', as: 'approver' });

// System Settings
db.settings = require("./setting.model.js")(sequelize, Sequelize);

// Onboarding / Employee Joining Profile Models
db.employee_profiles = require("./employee_profile.model.js")(sequelize, Sequelize);
db.employee_educations = require("./employee_education.model.js")(sequelize, Sequelize);
db.employee_experiences = require("./employee_experience.model.js")(sequelize, Sequelize);
db.employee_family_members = require("./employee_family_member.model.js")(sequelize, Sequelize);
db.employee_documents = require("./employee_document.model.js")(sequelize, Sequelize);

// Associations for Employee Onboarding / Profiles
db.user.hasOne(db.employee_profiles, { foreignKey: 'staff_id', as: 'profile_info', onDelete: 'CASCADE' });
db.employee_profiles.belongsTo(db.user, { foreignKey: 'staff_id' });

db.user.hasMany(db.employee_educations, { foreignKey: 'staff_id', as: 'educations', onDelete: 'CASCADE' });
db.employee_educations.belongsTo(db.user, { foreignKey: 'staff_id' });

db.user.hasMany(db.employee_experiences, { foreignKey: 'staff_id', as: 'experiences', onDelete: 'CASCADE' });
db.employee_experiences.belongsTo(db.user, { foreignKey: 'staff_id' });

db.user.hasMany(db.employee_family_members, { foreignKey: 'staff_id', as: 'family_members', onDelete: 'CASCADE' });
db.employee_family_members.belongsTo(db.user, { foreignKey: 'staff_id' });

db.user.hasMany(db.employee_documents, { foreignKey: 'staff_id', as: 'documents', onDelete: 'CASCADE' });
db.employee_documents.belongsTo(db.user, { foreignKey: 'staff_id' });

module.exports = db;


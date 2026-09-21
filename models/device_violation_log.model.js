module.exports = (sequelize, Sequelize) => {
    const DeviceViolationLog = sequelize.define("device_violation_logs", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        attempted_staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: 'Staff ID of the employee who attempted attendance'
        },
        bound_staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: 'Staff ID of the employee to whom the device is actively registered'
        },
        device_id: {
            type: Sequelize.STRING(128),
            allowNull: false,
            comment: 'Device fingerprint involved in the conflict'
        },
        device_name: {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Device model/browser'
        },
        ip_address: {
            type: Sequelize.STRING(64),
            allowNull: true,
            comment: 'IP address where attempt originated'
        },
        violation_type: {
            type: Sequelize.STRING(64),
            allowNull: false,
            defaultValue: 'PROXY_ATTENDANCE_DEVICE_CONFLICT',
            comment: 'Classification of the security violation'
        },
        details: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Additional context (e.g. employee names, email alert status)'
        },
        status: {
            type: Sequelize.ENUM('REPORTED', 'REVIEWED', 'RESOLVED'),
            allowNull: false,
            defaultValue: 'REPORTED',
            comment: 'Status of the HR review'
        },
        hr_notes: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Notes added by HR or administrator'
        },
        resolved_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Staff ID of HR/Admin who resolved the incident'
        },
        resolved_at: {
            type: Sequelize.DATE,
            allowNull: true,
            comment: 'Timestamp when incident was resolved'
        }
    }, {
        tableName: 'device_violation_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_device_violation_attempted',
                fields: ['attempted_staff_id']
            },
            {
                name: 'idx_device_violation_bound',
                fields: ['bound_staff_id']
            },
            {
                name: 'idx_device_violation_status',
                fields: ['status']
            }
        ]
    });

    return DeviceViolationLog;
};

module.exports = (sequelize, Sequelize) => {
    const EmployeeDevice = sequelize.define("employee_devices", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            comment: 'Staff ID of the employee owning this device'
        },
        device_id: {
            type: Sequelize.STRING(128),
            allowNull: false,
            comment: 'Persistent unique device fingerprint / UUID'
        },
        device_name: {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Human readable device model/platform name (e.g. iPhone 15 / Safari)'
        },
        user_agent: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Browser user-agent string'
        },
        ip_address: {
            type: Sequelize.STRING(64),
            allowNull: true,
            comment: 'Last IP address used by this device'
        },
        first_bound_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW,
            comment: 'When the employee first bound this device'
        },
        last_active_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW,
            comment: 'Last time this device was used for attendance/badge'
        },
        is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: 'Whether this device is currently the active device for the employee'
        }
    }, {
        tableName: 'employee_devices',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_employee_devices_staff_id',
                fields: ['staff_id']
            },
            {
                name: 'idx_employee_devices_device_id',
                fields: ['device_id']
            },
            {
                name: 'idx_employee_devices_active',
                fields: ['device_id', 'is_active']
            }
        ]
    });

    return EmployeeDevice;
};

module.exports = (sequelize, Sequelize) => {
    const EmployeeDocument = sequelize.define("employee_documents", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        document_type: {
            type: Sequelize.STRING(50),
            allowNull: false,
            comment: 'class_10, class_12, degree, identity, residence, pay_slip, relieving, experience, appointment, photo'
        },
        file_name: {
            type: Sequelize.STRING(255),
            allowNull: false
        },
        file_path: {
            type: Sequelize.STRING(255),
            allowNull: false
        },
        file_size: {
            type: Sequelize.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'employee_documents',
        timestamps: true
    });
    return EmployeeDocument;
};

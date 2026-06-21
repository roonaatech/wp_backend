module.exports = (sequelize, Sequelize) => {
    const EmployeeExperience = sequelize.define("employee_experiences", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        post_held: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        department_function: {
            type: Sequelize.STRING(100),
            allowNull: true
        },
        company_name: {
            type: Sequelize.STRING(150),
            allowNull: false
        },
        city: {
            type: Sequelize.STRING(100),
            allowNull: true
        },
        tenure: {
            type: Sequelize.STRING(50),
            allowNull: true
        },
        reference_contact: {
            type: Sequelize.STRING(255),
            allowNull: true
        }
    }, {
        tableName: 'employee_experiences',
        timestamps: false
    });
    return EmployeeExperience;
};

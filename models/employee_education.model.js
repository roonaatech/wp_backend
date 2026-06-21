module.exports = (sequelize, Sequelize) => {
    const EmployeeEducation = sequelize.define("employee_educations", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        qualification: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        specialization: {
            type: Sequelize.STRING(100),
            allowNull: true
        },
        grade: {
            type: Sequelize.STRING(20),
            allowNull: true
        },
        university_city: {
            type: Sequelize.STRING(150),
            allowNull: true
        },
        year_of_completion: {
            type: Sequelize.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'employee_educations',
        timestamps: false
    });
    return EmployeeEducation;
};

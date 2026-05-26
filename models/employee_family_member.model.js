module.exports = (sequelize, Sequelize) => {
    const EmployeeFamilyMember = sequelize.define("employee_family_members", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        name: {
            type: Sequelize.STRING(100),
            allowNull: false
        },
        relationship: {
            type: Sequelize.STRING(50),
            allowNull: false,
            comment: 'Brother, Sister'
        },
        work_status: {
            type: Sequelize.STRING(100),
            allowNull: true
        },
        educational_status: {
            type: Sequelize.STRING(100),
            allowNull: true
        },
        marital_status: {
            type: Sequelize.STRING(50),
            allowNull: true
        },
        residing_in: {
            type: Sequelize.STRING(100),
            allowNull: true
        }
    }, {
        tableName: 'employee_family_members',
        timestamps: false
    });
    return EmployeeFamilyMember;
};

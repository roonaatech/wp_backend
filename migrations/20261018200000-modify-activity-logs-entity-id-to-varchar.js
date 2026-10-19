'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('activity_logs', 'entity_id', {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: "ID of the affected entity"
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.changeColumn('activity_logs', 'entity_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: "ID of the affected entity"
        });
    }
};

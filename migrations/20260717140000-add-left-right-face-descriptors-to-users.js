'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('users');
        
        if (!tableInfo.face_descriptor_left) {
            await queryInterface.addColumn('users', 'face_descriptor_left', {
                type: Sequelize.TEXT('long'),
                allowNull: true,
                comment: 'Stringified JSON array representing left profile face embedding'
            });
        }
        if (!tableInfo.face_descriptor_right) {
            await queryInterface.addColumn('users', 'face_descriptor_right', {
                type: Sequelize.TEXT('long'),
                allowNull: true,
                comment: 'Stringified JSON array representing right profile face embedding'
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('users');

        if (tableInfo.face_descriptor_left) {
            await queryInterface.removeColumn('users', 'face_descriptor_left');
        }
        if (tableInfo.face_descriptor_right) {
            await queryInterface.removeColumn('users', 'face_descriptor_right');
        }
    }
};

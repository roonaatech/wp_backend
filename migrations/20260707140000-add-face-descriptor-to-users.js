'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('users');
        
        if (!tableInfo.face_descriptor) {
            await queryInterface.addColumn('users', 'face_descriptor', {
                type: Sequelize.TEXT('long'),
                allowNull: true,
                comment: 'Stringified JSON array representing 128-dimensional face embedding'
            });
        }
        if (!tableInfo.face_registered_at) {
            await queryInterface.addColumn('users', 'face_registered_at', {
                type: Sequelize.DATE,
                allowNull: true
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('users');

        if (tableInfo.face_descriptor) {
            await queryInterface.removeColumn('users', 'face_descriptor');
        }
        if (tableInfo.face_registered_at) {
            await queryInterface.removeColumn('users', 'face_registered_at');
        }
    }
};

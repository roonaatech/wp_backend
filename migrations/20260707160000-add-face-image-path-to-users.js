'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('users');

        if (!tableInfo.face_image_path) {
            await queryInterface.addColumn('users', 'face_image_path', {
                type: Sequelize.STRING(255),
                allowNull: true,
                comment: 'Path to the face capture used for face registration (kept separate from the profile photo)'
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('users');

        if (tableInfo.face_image_path) {
            await queryInterface.removeColumn('users', 'face_image_path');
        }
    }
};

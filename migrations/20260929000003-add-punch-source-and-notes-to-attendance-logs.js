'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const tableInfo = await queryInterface.describeTable('attendance_logs');

        if (!tableInfo.punch_source) {
            await queryInterface.addColumn('attendance_logs', 'punch_source', {
                type: Sequelize.STRING(32),
                allowNull: false,
                defaultValue: 'KIOSK_QR',
                comment: 'Attendance punch source: KIOSK_QR, MOBILE_WFH, WEB_WFH, MANUAL'
            });
        }

        if (!tableInfo.notes) {
            await queryInterface.addColumn('attendance_logs', 'notes', {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Optional employee punch notes or checkout summary'
            });
        }
    },

    down: async (queryInterface) => {
        const tableInfo = await queryInterface.describeTable('attendance_logs');
        if (tableInfo.notes) {
            await queryInterface.removeColumn('attendance_logs', 'notes');
        }
        if (tableInfo.punch_source) {
            await queryInterface.removeColumn('attendance_logs', 'punch_source');
        }
    }
};

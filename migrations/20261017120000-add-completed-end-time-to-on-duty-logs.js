module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            const tableInfo = await queryInterface.describeTable('on_duty_logs');

            if (!tableInfo.completed_end_time) {
                await queryInterface.addColumn('on_duty_logs', 'completed_end_time', {
                    type: Sequelize.DATE,
                    allowNull: true
                });
                console.log('Added completed_end_time column to on_duty_logs table');
            }
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        try {
            const tableInfo = await queryInterface.describeTable('on_duty_logs');
            if (tableInfo.completed_end_time) {
                await queryInterface.removeColumn('on_duty_logs', 'completed_end_time');
                console.log('Removed completed_end_time column from on_duty_logs table');
            }
        } catch (error) {
            console.error('Rollback error:', error);
            throw error;
        }
    }
};

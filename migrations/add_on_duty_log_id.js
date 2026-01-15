module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            // Check if column exists
            const tableInfo = await queryInterface.describeTable('approvals');
            if (!tableInfo.on_duty_log_id) {
                await queryInterface.addColumn('approvals', 'on_duty_log_id', {
                    type: Sequelize.INTEGER,
                    allowNull: true
                });
                console.log('Added on_duty_log_id column to approvals table');
            }
        } catch (error) {
            console.error('Migration error:', error);
        }
    },
    down: async (queryInterface, Sequelize) => {
        try {
            await queryInterface.removeColumn('approvals', 'on_duty_log_id');
            console.log('Removed on_duty_log_id column from approvals table');
        } catch (error) {
            console.error('Rollback error:', error);
        }
    }
};

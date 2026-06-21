module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            const tableInfo = await queryInterface.describeTable('on_duty_logs');
            
            // Add end_location if it doesn't exist
            if (!tableInfo.end_location) {
                await queryInterface.addColumn('on_duty_logs', 'end_location', {
                    type: Sequelize.STRING,
                    allowNull: true
                });
                console.log('Added end_location column to on_duty_logs table');
            }
            console.log('Location migration completed successfully');
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        try {
            await queryInterface.removeColumn('on_duty_logs', 'end_location');
            console.log('Removed end_location column from on_duty_logs table');
        } catch (error) {
            console.error('Rollback error:', error);
            throw error;
        }
    }
};

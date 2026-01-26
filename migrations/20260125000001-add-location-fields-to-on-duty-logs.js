module.exports = {
    up: async (queryInterface, Sequelize) => {
        try {
            const tableInfo = await queryInterface.describeTable('on_duty_logs');
            
            // Add start_lat if it doesn't exist
            if (!tableInfo.start_lat) {
                await queryInterface.addColumn('on_duty_logs', 'start_lat', {
                    type: Sequelize.STRING,
                    allowNull: true
                });
                console.log('Added start_lat column to on_duty_logs table');
            }
            
            // Add start_long if it doesn't exist
            if (!tableInfo.start_long) {
                await queryInterface.addColumn('on_duty_logs', 'start_long', {
                    type: Sequelize.STRING,
                    allowNull: true
                });
                console.log('Added start_long column to on_duty_logs table');
            }
            
            // Add end_lat if it doesn't exist
            if (!tableInfo.end_lat) {
                await queryInterface.addColumn('on_duty_logs', 'end_lat', {
                    type: Sequelize.STRING,
                    allowNull: true
                });
                console.log('Added end_lat column to on_duty_logs table');
            }
            
            // Add end_long if it doesn't exist
            if (!tableInfo.end_long) {
                await queryInterface.addColumn('on_duty_logs', 'end_long', {
                    type: Sequelize.STRING,
                    allowNull: true
                });
                console.log('Added end_long column to on_duty_logs table');
            }
            
            console.log('Location columns migration completed successfully');
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        try {
            await queryInterface.removeColumn('on_duty_logs', 'start_lat');
            await queryInterface.removeColumn('on_duty_logs', 'start_long');
            await queryInterface.removeColumn('on_duty_logs', 'end_lat');
            await queryInterface.removeColumn('on_duty_logs', 'end_long');
            console.log('Removed location columns from on_duty_logs table');
        } catch (error) {
            console.error('Rollback error:', error);
            throw error;
        }
    }
};

module.exports = (sequelize, Sequelize) => {
    const AnniversaryWishLog = sequelize.define("anniversary_wish_logs", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        staff_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'staffid'
            }
        },
        wish_date: {
            type: Sequelize.DATEONLY,
            allowNull: false,
            comment: 'Calendar date (application timezone) the wish was sent for'
        },
        sent_to: {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Comma separated addresses the wish was actually delivered to'
        },
        source: {
            type: Sequelize.ENUM('cron', 'manual'),
            allowNull: false,
            defaultValue: 'cron',
            comment: 'cron=scheduled job, manual=sent from the dashboard'
        },
        triggered_by: {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Staff who triggered a manual send; null for the scheduled job'
        },
        status: {
            type: Sequelize.ENUM('Sent', 'Failed'),
            allowNull: false,
            defaultValue: 'Sent'
        },
        error_message: {
            type: Sequelize.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'anniversary_wish_logs',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['staff_id', 'wish_date'],
                name: 'anniversary_wish_logs_staff_date_unique'
            }
        ]
    });

    return AnniversaryWishLog;
};

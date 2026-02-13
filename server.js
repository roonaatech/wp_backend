const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

process.on('uncaughtException', (err) => {
    console.error('Global Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Global Unhandled Rejection:', reason);
});

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const db = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
console.log("DB_HOST from env:", process.env.DB_HOST);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
        persistAuthorization: true,
        displayOperationId: false,
        tryItOutEnabled: true,
        deepLinking: true
    }
}));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the WorkPulse API. Visit /api-docs for documentation.' });
});

// Routes
require('./routes/auth.routes')(app);
require('./routes/role.routes')(app);
require("./routes/leavetype.routes")(app);
require('./routes/leave.routes')(app);
require('./routes/userleavetype.routes')(app);
require('./routes/onduty.routes')(app);
require('./routes/admin.routes')(app);
require('./routes/activity.routes')(app);
require('./routes/apk.routes')(app);
require('./routes/debug.routes')(app);
require('./routes/email.routes')(app);
require('./routes/timeoff.routes')(app);

// Sync database
db.sequelize.sync()
    .then(() => {
        console.log('Synced db.');
        // Seed Email Templates
        require('./utils/seed_templates')();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}.`);
            console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
            // Keep process alive check
            setInterval(() => { }, 1000 * 60);
        });
    })
    .catch((err) => {
        console.log('Failed to sync db: ' + err.message);
    });

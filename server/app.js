const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const cors = require('cors');
const express = require('express');

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get(['/health', '/api/health'], (_request, response) => {
    response.json({
        status: 'ok',
        service: 'lab-equipment-api',
        databaseConnectivity: 'not_checked',
        integrations: {
            firebase: process.env.FIREBASE_PROJECT_ID ? 'configured-not-checked' : 'not-configured',
        },
    });
});

app.use('/api', (_request, response) => {
    response.status(404).json({
        error: { code: 'NOT_FOUND', message: 'This API route has not been implemented.' },
    });
});

module.exports = app;

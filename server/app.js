const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const cors = require('cors');

const express = require('express');

const app = express();

const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',').map((origin) => origin.trim());

app.disable('x-powered-by');

app.use(cors({ origin: clientOrigins }));

app.use(express.json({ limit: '100kb' }));

app.get(['/health', '/api/health'], (_request, response) => {
    response.json({ status: 'ok', service: 'lab-equipment-api' });
});

app.use((_request, response) => {
    response.status(404).json({
        error: { code: 'NOT_FOUND', message: 'This API route has not been implemented.' },
    });
});

module.exports = app;

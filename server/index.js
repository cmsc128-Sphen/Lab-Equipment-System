const path = require('node:path');

require('dotenv').config({
    path: path.join(__dirname, '.env'),
    quiet: true,
});

const express = require('express');
const { getDatabase } = require('./src/database');

const app = express();

app.use(express.json({ limit: '100kb' }));

// Health checks only report HTTP availability, not Firestore connectivity.
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        databaseConnectivity: 'not_checked',
    });
});

if (require.main === module) {
    try {
        // INFO before startup; database access has not been attempted yet.
        console.log('[INFO] server.starting');

        getDatabase();

        const port = Number(process.env.PORT || 3000);
        const server = app.listen(port, () => {
            // INFO after the listener is ready; port identifies the local service.
            console.log(`[INFO] server.listening port=${server.address().port}`);
        });

        server.on('error', () => {
            // CRITICAL when the listener fails; stop without exposing environment details.
            console.error('[CRITICAL] server.listen_failed nextAction=stop_service');
            process.exitCode = 1;
        });
    } catch {
        // CRITICAL for startup failure; configuration must be corrected before retrying.
        console.error('[CRITICAL] server.startup_failed check=server_env_and_application_credentials nextAction=stop_service');
        process.exitCode = 1;
    }
}

module.exports = app;

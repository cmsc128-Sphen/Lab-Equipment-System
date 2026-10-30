const app = require('./app');
const { getDatabase } = require('./src/database');

if (require.main === module) {
    try {
        // INFO before service initialization; no database request has been sent.
        console.log('[INFO] server.starting');

        if (process.env.FIREBASE_PROJECT_ID) {
            getDatabase();
        } else {
            // WARN for intentional prototype-only startup; database operations still require configuration.
            console.warn('[WARN] server.database_not_configured nextAction=serve_prototype_only');
        }

        const port = Number(process.env.PORT || 3000);
        const server = app.listen(port, () => {
            // INFO after the listener starts; the port is safe service metadata.
            console.log(`[INFO] server.listening port=${server.address().port}`);
        });

        server.on('error', () => {
            // CRITICAL when listening fails; stop without exposing environment details.
            console.error('[CRITICAL] server.listen_failed nextAction=stop_service');
            process.exitCode = 1;
        });

        function shutdown() {
            // INFO when a termination signal is received; stop accepting requests.
            console.log('[INFO] server.shutdown_started');
            server.close((error) => {
                if (error) {
                    // ERROR on failed shutdown; the process exits unsuccessfully.
                    console.error('[ERROR] server.shutdown_failed nextAction=stop_service');
                    process.exitCode = 1;
                    return;
                }

                // INFO after active requests have finished and the listener has closed.
                console.log('[INFO] server.shutdown_completed');
                process.exit(0);
            });
        }

        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    } catch {
        // CRITICAL when configuration prevents startup; never print raw credential errors.
        console.error('[CRITICAL] server.startup_failed check=server_env_and_application_credentials nextAction=stop_service');
        process.exitCode = 1;
    }
}

module.exports = app;

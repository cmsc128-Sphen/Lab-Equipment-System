const path = require('node:path');

require('dotenv').config({
    path: path.join(__dirname, '.env'),
    quiet: true,
});

const { createApp } = require('./src/app');

const { readConfig, createSupabaseFactory } = require('./src/config/supabase');

if (require.main === module) {
    try {
        // INFO before startup; database access has not been attempted yet.
        console.log('[INFO] server.starting');

        const config = readConfig();

        const app = createApp({ createClient: createSupabaseFactory(config), config });

        // INFO after validating configuration; remote connectivity is verified by subsequent API requests.
        console.log('[INFO] supabase.configured connectivity=not_checked');

        const server = app.listen(config.port, () => {
            // INFO after the listener is ready; port identifies the local service.
            console.log(`[INFO] server.listening port=${server.address().port}`);
        });

        server.on('error', () => {
            // CRITICAL when the listener fails; stop without exposing environment details.
            console.error('[CRITICAL] server.listen_failed nextAction=stop_service');
            process.exitCode = 1;
        });

        function shutdown() {
            // INFO on a termination signal; stop accepting new requests and drain existing ones.
            console.log('[INFO] server.stopping');

            const shutdownTimeout = setTimeout(() => {
                // WARN if requests do not drain within ten seconds; close connections to finish shutdown.
                console.warn('[WARN] server.shutdown_timeout nextAction=close_connections');

                server.closeAllConnections();
            }, 10000);

            shutdownTimeout.unref();

            server.close(() => {
                clearTimeout(shutdownTimeout);

                // INFO after the listener drains successfully; the service can exit normally.
                console.log('[INFO] server.stopped');
            });
        }

        process.once('SIGTERM', shutdown);

        process.once('SIGINT', shutdown);
    } catch {
        // CRITICAL for startup failure; configuration must be corrected before retrying.
        console.error('[CRITICAL] server.startup_failed check=server_env nextAction=stop_service');
        process.exitCode = 1;
    }
}

module.exports = { createApp };

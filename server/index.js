const app = require('./app');

if (require.main === module) {
    try {
        // INFO before HTTP startup; no external services are initialized.
        console.log('[INFO] server.starting');

        const port = Number(process.env.PORT || 3000);

        if (!Number.isInteger(port) || port < 0 || port > 65535) {
            throw new Error('PORT must be a valid TCP port.');
        }

        const server = app.listen(port, () => {
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

module.exports = app;

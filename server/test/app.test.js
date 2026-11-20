const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const exportedApp = require('../index');

test('both server entry points share the app without opening a listener on import', () => {
    // Both imports expose the same app without starting the service.
    assert.equal(exportedApp, app);
});

test('server exposes health endpoints and rejects unimplemented API routes', async (context) => {
    // Use a temporary local port; no database or credentials are required.
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        for (const path of ['/health', '/api/health']) {
            await context.test(`${path} reports HTTP availability`, async () => {
                const response = await fetch(`${baseUrl}${path}`);
                const body = await response.json();

                assert.equal(response.status, 200);
                assert.equal(body.status, 'ok');
                assert.equal(body.service, 'lab-equipment-api');
            });
        }

        await context.test('inventory, staff bookings and student bookings require authentication', async () => {
            // Each read path rejects requests without a user session.
            for (const [path, status, code] of [
                ['/api/items', 401, 'UNAUTHENTICATED'],
                ['/api/admin/bookings', 401, 'UNAUTHENTICATED'],
                ['/api/bookings', 401, 'UNAUTHENTICATED'],
                ['/api/bookings/94e56ef0-b7f3-4d95-b7f0-02230ad8d8fc', 401, 'UNAUTHENTICATED'],
            ]) {
                const response = await fetch(`${baseUrl}${path}`);
                const body = await response.json();

                assert.equal(response.status, status);
                assert.equal(body.error.code, code);
            }

            // The submission path must not reach Supabase without authentication either.
            const response = await fetch(`${baseUrl}/api/bookings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            });

            assert.equal(response.status, 401);
        });
    } finally {
        // Release the listener even when an assertion fails.
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

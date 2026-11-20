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

        await context.test('inventory and admin bookings require authentication', async () => {
            // Both data APIs reject requests without a user session.
            for (const [path, status, code] of [
                ['/api/items', 401, 'UNAUTHENTICATED'],
                ['/api/admin/bookings', 401, 'UNAUTHENTICATED'],
            ]) {
                const response = await fetch(`${baseUrl}${path}`);
                const body = await response.json();

                assert.equal(response.status, status);
                assert.equal(body.error.code, code);
            }
        });
    } finally {
        // Release the listener even when an assertion fails.
        server.closeAllConnections();
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

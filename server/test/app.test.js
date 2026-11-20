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

        await context.test('unused API routes return explicit errors', async () => {
            // The scaffold must not pretend that inventory or booking features exist.
            for (const path of ['/api/items', '/api/admin/bookings']) {
                const response = await fetch(`${baseUrl}${path}`);
                const body = await response.json();

                assert.equal(response.status, 404);
                assert.equal(body.error.code, 'NOT_FOUND');
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

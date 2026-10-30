const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const exportedApp = require('../index');

test('both server entry points share the app without opening a listener on import', () => {
    // Importing the database entry point must keep health-route tests independent of credentials.
    assert.equal(exportedApp, app);
});

test('merged HTTP scaffold preserves both health paths and rejects unfinished API routes', async (context) => {
    // Use a temporary local port; these requests never contact Firebase.
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        for (const path of ['/health', '/api/health']) {
            await context.test(`${path} reports HTTP availability without claiming database connectivity`, async () => {
                const response = await fetch(`${baseUrl}${path}`);
                const body = await response.json();

                assert.equal(response.status, 200);
                assert.equal(body.status, 'ok');
                assert.equal(body.databaseConnectivity, 'not_checked');
            });
        }

        await context.test('unfinished item and booking endpoints return explicit errors', async () => {
            // A prototype route must never pretend that a request was saved.
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

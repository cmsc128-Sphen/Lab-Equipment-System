const test = require('node:test');

const assert = require('node:assert/strict');

const { getSupabase, checkSupabaseConnection } = require('../supabase');

test.before(() => {
    // Use test-only configuration; these checks must never contact a real project.
    process.env.SUPABASE_URL = 'https://les-test.supabase.co';

    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
});

test('connection check reads public settings with the key and reuses the SDK client', async (context) => {
    context.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url.pathname, '/auth/v1/settings');

        assert.equal(options.headers.apikey, 'sb_publishable_test');

        assert.equal(options.method || 'GET', 'GET');

        return new Response(JSON.stringify({ external: { email: true } }));
    });

    const result = await checkSupabaseConnection();

    assert.deepEqual(result, { status: 'ok', supabase: 'reachable', database: 'not_checked' });

    assert.equal(getSupabase(), getSupabase());
});

test('rejected keys and network failures return safe errors without reporting success', async (context) => {
    const logs = [];

    context.mock.method(console, 'log', (message) => logs.push(message));

    context.mock.method(globalThis, 'fetch', async () => new Response('private provider detail', { status: 401 }));

    await assert.rejects(checkSupabaseConnection(), {
        message: 'Could not reach Supabase. Check the project status and server/.env settings.',
    });

    // Network exceptions can contain credential-bearing URLs; do not propagate them.
    context.mock.method(globalThis, 'fetch', async () => {
        throw new Error('private network detail');
    });

    await assert.rejects(checkSupabaseConnection(), {
        message: 'Could not reach Supabase. Check the project status and server/.env settings.',
    });

    assert.equal(logs.some((message) => message.includes('connection_check_completed')), false);
});

const test = require('node:test');

const assert = require('node:assert/strict');

const express = require('express');

const { createClient } = require('@supabase/supabase-js');

const { createAuthenticationMiddleware } = require('../auth');

const { createInventoryRouter } = require('../inventory');

function fixture(context, options = {}) {
    const originalFetch = globalThis.fetch;

    const queries = [];

    const rows = options.empty ? [] : [
        { id: 'beaker', code: 'MOCK-EQ-001', name: 'Beaker', name_lower: 'beaker', type: 'equipment', unit: 'pcs', available: 1800 },
        { id: 'ethanol', code: 'MOCK-CHEM-001', name: 'Ethanol', name_lower: 'ethanol', type: 'chemical', unit: 'mL', available: 240025 },
        { id: 'retired', code: 'MOCK-EQ-007', name: 'Retired item', name_lower: 'retired', type: 'equipment', unit: 'pcs', available: 100, is_active: false },
        { id: 'inactive-category', code: 'MOCK-EQ-008', name: 'Hidden category', name_lower: 'hidden category', type: 'equipment', unit: 'pcs', available: 100, categoryActive: false },
    ].map((item) => ({
        quantity_scale: 100,
        reserved: 0,
        checked_out: 0,
        unusable: 0,
        status: 'available',
        specification: 'Development sample',
        tags: ['mock'],
        chemical: null,
        location: 'Cabinet A',
        category_id: 'demo',
        category: { name: 'Demo category', is_active: item.categoryActive !== false },
        is_active: true,
        total: item.available,
        ...item,
    }));

    // Use the real SDK and mock only Supabase's network boundary.
    context.mock.method(globalThis, 'fetch', async (input, init = {}) => {
        const url = new URL(input);

        if (url.hostname !== 'inventory-test.supabase.co') {
            return originalFetch(input, init);
        }

        const headers = new Headers(init.headers);

        const token = headers.get('Authorization')?.replace('Bearer ', '');

        function json(body, status = 200, extraHeaders = {}) {
            return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
        }

        if (url.pathname === '/auth/v1/user') {
            if (token === 'expired') {
                return json({ msg: 'Invalid token' }, 401);
            }

            return json({ id: token, email: 'test@example.invalid', email_confirmed_at: '2026-11-20' });
        }

        if (url.pathname === '/rest/v1/profiles') {
            return json(token === 'inactive' ? [] : [{ id: token, role: 'student', is_active: true }]);
        }

        assert.equal(url.pathname, '/rest/v1/items');

        queries.push({ url, token });

        if (options.failure) {
            return json({ code: 'XX000', message: 'Private upstream details' }, 500);
        }

        let visible = [...rows];

        if (url.searchParams.get('is_active') === 'eq.true') {
            visible = visible.filter((item) => item.is_active);
        }

        if (url.searchParams.get('category.is_active') === 'eq.true') {
            visible = visible.filter((item) => item.category.is_active);
        }

        visible.sort((left, right) => left.name_lower.localeCompare(right.name_lower) || left.id.localeCompare(right.id));

        const offset = Number(url.searchParams.get('offset'));

        const limit = Number(url.searchParams.get('limit'));

        const page = visible.slice(offset, offset + limit);

        if (options.unsafe && page.length) {
            page[0] = { ...page[0], available: Number.MAX_SAFE_INTEGER + 1 };
        }

        return json(page, 200, { 'Content-Range': `${offset}-${offset + page.length - 1}/${visible.length}` });
    });

    const authenticate = createAuthenticationMiddleware((token) => createClient('https://inventory-test.supabase.co', 'sb_publishable_test', {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }));

    const app = express();

    app.use('/api', createInventoryRouter(authenticate));

    return { app, queries };
}

async function withServer(app, run) {
    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve, reject) => {
        server.once('listening', resolve);

        server.once('error', reject);
    });

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.closeAllConnections();

        await new Promise((resolve) => server.close(resolve));
    }
}

test('catalogue preserves display units, joins categories and hides retired records', async (context) => {
    const { app, queries } = fixture(context);

    await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/items`, { headers: { Authorization: 'Bearer student' } });

        const body = await response.json();

        assert.equal(response.status, 200);

        assert.equal(body.total, 2);

        assert.equal(body.truncated, false);

        assert.deepEqual(body.items.map((item) => item.id), ['beaker', 'ethanol']);

        assert.equal(body.items[0].stock.available, 1800);

        assert.equal(body.items[1].stock.available, 240025);

        assert.equal(body.items[1].quantityScale, 100);

        assert.equal(body.items[1].categoryName, 'Demo category');

        assert.equal(body.items[1].primaryImage, null);

        assert.match(response.headers.get('cache-control'), /no-store/);

        // The request's user-scoped SDK client carries the caller's JWT into PostgREST.
        assert.equal(queries[0].token, 'student');

        assert.match(queries[0].url.searchParams.get('select'), /category:categories!items_category_id_type_fkey!inner/);

        assert.equal(queries[0].url.searchParams.get('order'), 'name_lower.asc,id.asc');
    });
});

test('catalogue pagination returns later records without repeating the first page', async (context) => {
    const { app } = fixture(context);

    await withServer(app, async (baseUrl) => {
        const headers = { Authorization: 'Bearer student' };

        const first = await (await fetch(`${baseUrl}/api/items?page=1&limit=1`, { headers })).json();

        const second = await (await fetch(`${baseUrl}/api/items?page=2&limit=1`, { headers })).json();

        assert.equal(first.truncated, true);

        assert.equal(second.truncated, false);

        assert.equal(first.total, 2);

        assert.deepEqual([...first.items, ...second.items].map((item) => item.id), ['beaker', 'ethanol']);
    });
});

test('missing, expired and inactive accounts cannot query the catalogue', async (context) => {
    const { app, queries } = fixture(context);

    await withServer(app, async (baseUrl) => {
        for (const [token, status] of [['', 401], ['expired', 401], ['inactive', 403]]) {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            assert.equal((await fetch(`${baseUrl}/api/items`, { headers })).status, status);
        }

        assert.equal(queries.length, 0);
    });
});

test('invalid pagination and unsupported filters fail before catalogue queries', async (context) => {
    const { app, queries } = fixture(context);

    await withServer(app, async (baseUrl) => {
        for (const query of ['page=0', 'limit=201', 'page=1.5', 'page=1&page=2', 'search=ignored']) {
            const response = await fetch(`${baseUrl}/api/items?${query}`, { headers: { Authorization: 'Bearer student' } });

            assert.equal(response.status, 400, query);
        }

        assert.equal(queries.length, 0);
    });
});

test('an empty catalogue succeeds with an explicit zero count', async (context) => {
    const { app } = fixture(context, { empty: true });

    await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/items`, { headers: { Authorization: 'Bearer student' } });

        assert.equal(response.status, 200);

        assert.deepEqual(await response.json(), { items: [], total: 0, page: 1, limit: 200, truncated: false });
    });
});

test('provider failures and unsafe quantities return sanitized errors', async (context) => {
    for (const options of [{ failure: true }, { unsafe: true }]) {
        const { app } = fixture(context, options);

        await withServer(app, async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/items`, { headers: { Authorization: 'Bearer student' } });

            assert.equal(response.status, 503);

            assert.doesNotMatch(await response.text(), /Private upstream details/);
        });

        context.mock.restoreAll();
    }
});

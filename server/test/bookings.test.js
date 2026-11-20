const test = require('node:test');

const assert = require('node:assert/strict');

const express = require('express');

const { createClient } = require('@supabase/supabase-js');

const { createBookingsRouter } = require('../bookings');

const bookingId = '94e56ef0-b7f3-4d95-b7f0-02230ad8d8fc';

const lineId = 'a6b340cc-ccb0-4140-a6f3-387f8c38af3a';

async function fixture(context, options = {}) {
    const queries = [];

    const supabase = createClient('https://booking-test.supabase.co', 'publishable-test', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: { Authorization: 'Bearer staff-session' },
            fetch: async (input, init) => {
                const url = new URL(input);

                queries.push({ url, init });

                if (url.pathname.endsWith('/rpc/review_booking')) {
                    return options.decisionError
                        ? new Response(JSON.stringify({ message: options.decisionError, code: 'P0001' }), { status: 400 })
                        : new Response(null, { status: 204 });
                }

                if (options.failure) return new Response(JSON.stringify({ message: 'Private provider details' }), { status: 500 });

                const rows = options.empty ? [] : url.pathname.endsWith('/requests')
                    ? [{ id: bookingId, request_no: 'REQ-2026-1' }]
                    : [{ id: lineId, request_id: bookingId, qty_requested: 15050, item: { available: 240025 } }];

                return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${rows.length - 1}/${rows.length}` } });
            },
        },
    });

    const app = express();

    app.use(express.json());

    // Authentication itself has separate tests; this fixture isolates role checks and real SDK requests.
    app.use('/api', createBookingsRouter((request, _response, next) => {
        request.auth = { profile: { role: options.role || 'admin' }, supabase };

        next();
    }));

    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve) => server.once('listening', resolve));

    context.after(async () => {
        server.closeAllConnections();

        await new Promise((resolve) => server.close(resolve));
    });

    return { url: `http://127.0.0.1:${server.address().port}/api/admin/bookings`, queries };
}

function decision(overrides = {}) {
    return { action: 'approved', updatedAt: '2026-11-20T10:00:00.123456+00:00',
        allocations: [{ id: lineId, quantity: 15050 }], staffNotes: '', denialReason: '', ...overrides };
}

test('student accounts cannot list bookings or save decisions', async (context) => {
    const { url, queries } = await fixture(context, { role: 'student' });

    assert.equal((await fetch(url)).status, 403);

    assert.equal((await fetch(`${url}/${bookingId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision()) })).status, 403);

    assert.equal(queries.length, 0);
});

test('staff queue reads snapshots and separately paged lines with the user session', async (context) => {
    const { url, queries } = await fixture(context, { role: 'lab_aid' });

    const response = await fetch(url);

    const body = await response.json();

    assert.equal(response.status, 200);

    assert.equal(body.bookings[0].lines[0].qty_requested, 15050);

    assert.equal(body.truncated, false);

    assert.match(queries[0].url.searchParams.get('select'), /requester_snapshot/);

    assert.equal(queries[0].url.searchParams.get('status'), 'eq.pending');

    assert.match(queries[1].url.searchParams.get('request_id'), new RegExp(bookingId));

    assert.equal(new Headers(queries[0].init.headers).get('Authorization'), 'Bearer staff-session');
});

test('empty queues are valid and database failures expose no private provider details', async (context) => {
    const empty = await fixture(context, { empty: true });

    assert.deepEqual((await (await fetch(empty.url)).json()).bookings, []);

    const failed = await fixture(context, { failure: true });

    const response = await fetch(failed.url);

    assert.equal(response.status, 503);

    assert.doesNotMatch(await response.text(), /Private provider/);
});

test('invalid pages are rejected before database work', async (context) => {
    const { url, queries } = await fixture(context);

    assert.equal((await fetch(`${url}?page=0`)).status, 400);

    assert.equal(queries.length, 0);
});

test('staff decision endpoint clearly defers changes without calling Supabase', async (context) => {
    const { url, queries } = await fixture(context);

    const response = await fetch(`${url}/${bookingId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision()),
    });

    assert.equal(response.status, 501);
    assert.equal((await response.json()).error.code, 'BOOKING_DECISIONS_DEFERRED');
    assert.equal(queries.length, 0);
});

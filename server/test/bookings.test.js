const test = require('node:test');

const assert = require('node:assert/strict');

const express = require('express');

const { createClient } = require('@supabase/supabase-js');

const { createBookingsRouter } = require('../bookings');

const bookingId = '94e56ef0-b7f3-4d95-b7f0-02230ad8d8fc';

const lineId = 'a6b340cc-ccb0-4140-a6f3-387f8c38af3a';

const studentId = '51fd07ae-162c-4345-81ea-7fdbcf0c87c3';

async function fixture(context, options = {}) {
    const queries = [];

    const supabase = createClient('https://booking-test.supabase.co', 'publishable-test', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: { Authorization: 'Bearer staff-session' },
            fetch: async (input, init) => {
                const url = new URL(input);

                queries.push({ url, init });

                if (url.pathname.endsWith('/rpc/submit_booking')) {
                    return options.submitError
                        ? new Response(JSON.stringify({ message: options.submitError, code: 'P0001' }), { status: 400 })
                        : new Response(JSON.stringify(options.submitResult ?? { id: bookingId, reference: 'REQ-2026-7', status: 'pending', createdAt: '2026-11-20T10:00:00+00:00', replayed: false }), { headers: { 'Content-Type': 'application/json' } });
                }

                if (url.pathname.endsWith('/rpc/review_booking')) {
                    return options.decisionError
                        ? new Response(JSON.stringify({ message: options.decisionError, code: 'P0001' }), { status: 400 })
                        : new Response(null, { status: 204 });
                }

                if (options.failure) return new Response(JSON.stringify({ message: 'Private provider details' }), { status: 500 });

                const rows = options.empty ? [] : url.pathname.endsWith('/requests')
                    ? [{ id: bookingId, request_no: 'REQ-2026-1' }]
                    : [{ id: lineId, request_id: bookingId, qty_requested: 15050, item: { available: 240025 } }];

                const body = new Headers(init.headers).get('Accept') === 'application/vnd.pgrst.object+json'
                    ? (rows[0] ?? null) : rows;

                const count = url.pathname.endsWith('/request_items') ? (options.lineCount ?? rows.length) : rows.length;

                return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${rows.length - 1}/${count}` } });
            },
        },
    });

    const app = express();

    app.use(express.json());

    // Authentication itself has separate tests; this fixture isolates role checks and real SDK requests.
    app.use('/api', createBookingsRouter((request, _response, next) => {
        request.auth = { user: { id: studentId }, profile: { role: options.role || 'admin' }, supabase };

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

test('invalid pages and fractional hundredths are rejected before database work', async (context) => {
    const { url, queries } = await fixture(context);

    assert.equal((await fetch(`${url}?page=0`)).status, 400);

    const response = await fetch(`${url}/${bookingId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision({ allocations: [{ id: lineId, quantity: 1.5 }] })) });

    assert.equal(response.status, 400);

    assert.equal(queries.length, 0);
});

test('approval uses one RPC and preserves version, allocation, and safe conflict response', async (context) => {
    const { url, queries } = await fixture(context);

    const response = await fetch(`${url}/${bookingId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision()) });

    assert.equal(response.status, 204);

    assert.equal(queries.length, 1);

    const payload = JSON.parse(queries[0].init.body);

    assert.equal(payload.p_allocations[0].quantity, 15050);

    assert.equal(payload.p_expected_updated_at, decision().updatedAt);

    const conflict = await fixture(context, { decisionError: 'BOOKING_CONFLICT' });

    const rejected = await fetch(`${conflict.url}/${bookingId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision()) });

    assert.equal(rejected.status, 409);

    assert.match((await rejected.json()).error.message, /Refresh/);
});

const itemId = 'c1f6d7a2-3b4c-4d5e-8f90-123456789abc';

function submission(overrides = {}) {
    return { submissionKey: 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f', subject: 'Chem 16', purpose: 'Research',
        borrowDate: '2026-11-25', returnDate: '2026-11-26', items: [{ inventoryId: itemId, quantity: 200 }], ...overrides };
}

function submit(url, body) {
    return fetch(url.replace('/admin/bookings', '/bookings'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('students submit through one RPC and get the saved Pending reference', async (context) => {
    const { url, queries } = await fixture(context, { role: 'student' });

    const response = await submit(url, { ...submission(), borrower: { id: 'someone-else' }, status: 'approved' });

    assert.equal(response.status, 201);

    assert.deepEqual(await response.json(), { id: bookingId, reference: 'REQ-2026-7', status: 'Pending', createdAt: '2026-11-20T10:00:00+00:00' });

    assert.equal(queries.length, 1);

    const payload = JSON.parse(queries[0].init.body);

    // Owner and status are never forwarded; the database takes them from the session.
    assert.deepEqual(Object.keys(payload).sort(), ['p_borrow_date', 'p_items', 'p_purpose', 'p_return_date', 'p_subject', 'p_submission_key']);

    assert.deepEqual(payload.p_items, [{ inventoryId: itemId, quantity: 200 }]);
});

test('a retried submission key returns the original request with 200', async (context) => {
    const { url } = await fixture(context, { role: 'student', submitResult: { id: bookingId, reference: 'REQ-2026-7', status: 'pending', createdAt: '2026-11-20T10:00:00+00:00', replayed: true } });

    const response = await submit(url, submission());

    assert.equal(response.status, 200);

    assert.equal((await response.json()).reference, 'REQ-2026-7');
});

test('staff accounts and malformed submissions are rejected before database work', async (context) => {
    const staff = await fixture(context, { role: 'admin' });

    assert.equal((await submit(staff.url, submission())).status, 403);

    assert.equal(staff.queries.length, 0);

    const { url, queries } = await fixture(context, { role: 'student' });

    for (const body of [
        submission({ submissionKey: 'not-a-uuid' }),
        submission({ items: [] }),
        submission({ items: [{ inventoryId: itemId, quantity: 1.5 }] }),
        submission({ items: [{ inventoryId: itemId, quantity: 0 }] }),
        submission({ borrowDate: '25/11/2026' }),
        submission({ borrowDate: '2026-02-30' }),
        submission({ returnDate: '2026-13-01' }),
        submission({ borrowDate: '0000-01-01' }),
        submission({ subject: 3 }),
    ]) {
        assert.equal((await submit(url, body)).status, 400, JSON.stringify(body));
    }

    assert.equal(queries.length, 0);
});

test('database validation failures return specific messages and unknown failures stay private', async (context) => {
    const stock = await fixture(context, { role: 'student', submitError: 'BOOKING_STOCK_EXCEEDED' });

    const rejected = await submit(stock.url, submission());

    assert.equal(rejected.status, 409);

    assert.match((await rejected.json()).error.message, /enough stock/);

    const unknown = await fixture(context, { role: 'student', submitError: 'duplicate key value violates private_constraint' });

    const failed = await submit(unknown.url, submission());

    assert.equal(failed.status, 503);

    assert.doesNotMatch(await failed.text(), /private_constraint/);

    const odd = await fixture(context, { role: 'student', submitResult: { reference: 'REQ-1', status: 'approved' } });

    assert.equal((await submit(odd.url, submission())).status, 503);
});

test('a replay after review returns the saved current status rather than a false save failure', async (context) => {
    const { url } = await fixture(context, { role: 'student', submitResult: {
        id: bookingId, reference: 'REQ-2026-7', status: 'approved', createdAt: '2026-11-20T10:00:00+00:00', replayed: true,
    } });

    const response = await submit(url, submission());

    assert.equal(response.status, 200);

    assert.equal((await response.json()).status, 'Approved');
});

test('a key reused for different content gives a conflict instead of confirming the changed draft', async (context) => {
    const { url } = await fixture(context, { role: 'student', submitError: 'BOOKING_SUBMISSION_CONFLICT' });

    const response = await submit(url, submission());

    assert.equal(response.status, 409);

    assert.equal((await response.json()).error.code, 'BOOKING_SUBMISSION_CONFLICT');
});

test('student history and receipts explicitly filter by the authenticated owner', async (context) => {
    const { url, queries } = await fixture(context, { role: 'student' });

    const studentUrl = url.replace('/admin/bookings', '/bookings');

    const response = await fetch(studentUrl);

    assert.equal(response.status, 200);

    assert.equal((await response.json()).limit, 20);

    assert.equal(queries[0].url.searchParams.get('requester_id'), `eq.${studentId}`);

    const receipt = await fetch(`${studentUrl}/${bookingId}`);

    assert.equal(receipt.status, 200);

    assert.equal((await receipt.json()).request.items[0].id, lineId);

    assert.equal(queries[1].url.searchParams.get('requester_id'), `eq.${studentId}`);

    assert.equal(queries[1].url.searchParams.get('id'), `eq.${bookingId}`);
});

test('missing or other-owner receipts return 404 and never query their lines', async (context) => {
    const { url, queries } = await fixture(context, { role: 'student', empty: true });

    const response = await fetch(`${url.replace('/admin/bookings', '/bookings')}/${bookingId}`);

    assert.equal(response.status, 404);

    assert.equal(queries.length, 1);
});

test('student read endpoints reject invalid query filters and staff roles', async (context) => {
    const student = await fixture(context, { role: 'student' });

    const url = student.url.replace('/admin/bookings', '/bookings');

    assert.equal((await fetch(`${url}?requester_id=someone-else`)).status, 400);

    assert.equal((await fetch(`${url}/not-an-id`)).status, 400);

    assert.equal(student.queries.length, 0);

    const staff = await fixture(context);

    assert.equal((await fetch(staff.url.replace('/admin/bookings', '/bookings'))).status, 403);

    assert.equal(staff.queries.length, 0);
});

test('student read failures stay private and incomplete receipts are never returned', async (context) => {
    // Upstream failures must not expose provider messages or look like empty successful histories.
    const failed = await fixture(context, { role: 'student', failure: true });

    const failedUrl = failed.url.replace('/admin/bookings', '/bookings');

    for (const path of [failedUrl, `${failedUrl}/${bookingId}`]) {
        const response = await fetch(path);

        assert.equal(response.status, 503);

        assert.doesNotMatch(await response.text(), /Private provider/);
    }

    // A response with fewer lines than its count is an error, not a partial borrowing slip.
    const partial = await fixture(context, { role: 'student', lineCount: 2 });

    const receipt = await fetch(`${partial.url.replace('/admin/bookings', '/bookings')}/${bookingId}`);

    assert.equal(receipt.status, 503);
});

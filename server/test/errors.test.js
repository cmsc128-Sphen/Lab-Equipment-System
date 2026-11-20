const test = require('node:test');

const assert = require('node:assert/strict');

const express = require('express');

const app = require('../app');

const { apiErrorHandler } = require('../errors');

async function listen(context, application) {
    const server = application.listen(0, '127.0.0.1');

    await new Promise((resolve, reject) => {
        server.once('listening', resolve);

        server.once('error', reject);
    });

    context.after(async () => {
        server.closeAllConnections();

        await new Promise((resolve) => server.close(resolve));
    });

    return `http://127.0.0.1:${server.address().port}`;
}

async function expectError(response, status, code) {
    assert.equal(response.status, status);

    assert.match(response.headers.get('content-type'), /^application\/json/);

    assert.equal(response.headers.get('cache-control'), 'no-store');

    const body = await response.json();

    assert.equal(body.error.code, code);

    assert.equal(typeof body.error.message, 'string');

    assert.deepEqual(Object.keys(body), ['error']);

    assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);

    return body;
}

test('malformed JSON gets a safe JSON error before authentication or database access', async (context) => {
    const baseUrl = await listen(context, app);

    // Broken syntax and JSON primitives are both invalid bodies for this object-based API.
    for (const body of ['{"private-body-marker":', 'null', '42']) {
        const response = await fetch(`${baseUrl}/api/bookings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        });

        const result = await expectError(response, 400, 'INVALID_JSON');

        assert.doesNotMatch(JSON.stringify(result), /private-body-marker|SyntaxError|stack|node_modules/);
    }

    // A bad request must not affect the server's next request.
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);

    const valid = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });

    assert.equal(valid.status, 401);
});

test('oversized JSON gets a 413 response using the API error envelope', async (context) => {
    const baseUrl = await listen(context, app);

    // Exercise the actual parser limit rather than fabricating an error object.
    const response = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'x'.repeat(101 * 1024) }),
    });

    await expectError(response, 413, 'PAYLOAD_TOO_LARGE');
});

test('unsupported body encodings return safe 415 responses', async (context) => {
    const baseUrl = await listen(context, app);

    for (const [headers, code] of [
        [{ 'Content-Type': 'application/json; charset=iso-8859-1' }, 'UNSUPPORTED_CHARSET'],
        [{ 'Content-Type': 'application/json', 'Content-Encoding': 'unknown' }, 'UNSUPPORTED_ENCODING'],
    ]) {
        const response = await fetch(`${baseUrl}/api/bookings`, { method: 'POST', headers, body: '{}' });

        await expectError(response, 415, code);
    }
});

test('unexpected synchronous and asynchronous failures hide exception details in responses and logs', async (context) => {
    const application = express();

    const logs = [];

    context.mock.method(console, 'error', (...values) => logs.push(values.join(' ')));

    const privateError = Object.assign(new Error('private-exception-marker'), {
        body: 'private-body-marker', stack: 'private-stack-marker',
    });

    // Use isolated throwing routes with the production handler; no test-only routes enter the real app.
    application.get('/sync', () => { throw privateError; });

    application.get('/async', async () => { throw privateError; });

    application.use(apiErrorHandler);

    const baseUrl = await listen(context, application);

    for (const path of ['/sync', '/async']) {
        const result = await expectError(await fetch(`${baseUrl}${path}`), 500, 'INTERNAL_ERROR');

        assert.doesNotMatch(JSON.stringify(result), /private-|stack/);
    }

    assert.equal(logs.length, 2);

    assert.doesNotMatch(logs.join('\n'), /private-/);
});

test('request rejection logs exclude the parser exception and submitted body', (context) => {
    const logs = [];

    context.mock.method(console, 'warn', (...values) => logs.push(values.join(' ')));

    const response = {
        headersSent: false,
        set() { return this; },
        status() { return this; },
        json() {},
    };

    apiErrorHandler({ type: 'entity.parse.failed', message: 'private-message', body: 'private-body' }, {}, response, () => assert.fail());

    assert.equal(logs.length, 1);

    assert.doesNotMatch(logs[0], /private-/);
});

test('errors after a response starts are delegated without writing another response', () => {
    const error = new Error('response already started');

    let delegated;

    // Express must close or finish the existing response instead of appending a JSON error to it.
    apiErrorHandler(error, {}, { headersSent: true }, (nextError) => { delegated = nextError; });

    assert.equal(delegated, error);
});

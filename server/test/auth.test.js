const test = require('node:test');

const assert = require('node:assert/strict');

const express = require('express');

const { createAuthenticationMiddleware, requireRoles } = require('../auth');

async function withServer(app, run) {
    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve) => server.once('listening', resolve));

    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        server.closeAllConnections();

        await new Promise((resolve) => server.close(resolve));
    }
}

test('account checks reject unauthenticated and unavailable users without trusting request roles', async () => {
    const app = express();

    const clients = [];

    const authenticate = createAuthenticationMiddleware((token) => {
        clients.push(token);

        return {
            auth: {
                async getUser(receivedToken) {
                    assert.equal(receivedToken, token);

                    if (token === 'expired') {
                        return { data: { user: null }, error: { status: 401 } };
                    }

                    if (token === 'offline') {
                        throw new Error('Private upstream details');
                    }

                    return {
                        data: { user: { id: token, email: 'test@example.invalid', email_confirmed_at: token === 'unverified' ? null : '2026-11-20' } },
                        error: null,
                    };
                },
            },
            from(table) {
                assert.equal(table, 'profiles');

                return {
                    select() { return this; },
                    eq(column, userId) {
                        assert.equal(column, 'id');

                        assert.equal(userId, token);

                        return this;
                    },
                    async maybeSingle() {
                        const profile = {
                            id: token,
                            role: token === 'staff' ? 'lab_aid' : token === 'admin' ? 'admin' : 'student',
                            is_active: token !== 'inactive',
                        };

                        return { data: token === 'missing' ? null : profile, error: null };
                    },
                };
            },
        };
    });

    app.get('/me', authenticate, (request, response) => response.json({ profile: request.auth.profile }));

    app.get('/staff', authenticate, requireRoles('lab_aid', 'admin'), (_request, response) => response.json({ allowed: true }));

    await withServer(app, async (baseUrl) => {
        // A malformed header never reaches Supabase.
        for (const authorization of ['', 'Basic student', 'Bearer student extra']) {
            const response = await fetch(`${baseUrl}/me`, { headers: { Authorization: authorization } });

            assert.equal(response.status, 401);
        }

        assert.equal(clients.length, 0);

        // Invalid, unverified and unavailable accounts cannot enter the app.
        for (const [token, expected] of [['expired', 401], ['unverified', 403], ['inactive', 403], ['missing', 403], ['offline', 503]]) {
            const response = await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${token}` } });

            assert.equal(response.status, expected, token);

            assert.match(response.headers.get('cache-control'), /no-store/);

            assert.doesNotMatch(await response.text(), /Private upstream details/);
        }

        // Role hints in URLs and headers cannot elevate a student to staff.
        const denied = await fetch(`${baseUrl}/staff?role=admin`, {
            headers: { Authorization: 'Bearer student', 'X-Role': 'admin' },
        });

        assert.equal(denied.status, 403);

        for (const token of ['staff', 'admin']) {
            const response = await fetch(`${baseUrl}/staff`, { headers: { Authorization: `Bearer ${token}` } });

            assert.equal(response.status, 200);
        }

        // Back-to-back users retain their own identity and role.
        for (const token of ['student', 'staff', 'student']) {
            const response = await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${token}` } });

            const body = await response.json();

            assert.equal(body.profile.id, token);
        }
    });
});

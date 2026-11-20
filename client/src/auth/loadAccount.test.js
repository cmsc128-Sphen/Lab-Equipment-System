import test from 'node:test'

import assert from 'node:assert/strict'

import { loadAccount } from './loadAccount.js'

const session = { access_token: 'test-token', user: { id: 'test-user' } }

test('account checks report empty and HTML proxy responses without exposing JSON parser errors', async () => {
    // Proxy failures are not necessarily JSON, even though the API normally returns JSON.
    for (const response of [new Response('', { status: 500 }), new Response('<html>Not found</html>', { status: 404 }), new Response('')]) {
        await assert.rejects(loadAccount(session, undefined, async () => response), {
            message: 'The account service returned an invalid response. Please try again.',
        })
    }
})

test('account checks distinguish network failures and timeouts from rejected accounts', async () => {
    await assert.rejects(loadAccount(session, undefined, async () => {
        throw new TypeError('Failed to fetch')
    }), /Unable to reach the account service/)

    await assert.rejects(loadAccount(session, undefined, async () => {
        throw new DOMException('Timed out', 'TimeoutError')
    }), /timed out/)

    // Valid API error messages should still explain missing or inactive profiles.
    await assert.rejects(loadAccount(session, undefined, async () => Response.json({
        error: { message: 'Your account has no active laboratory profile.' },
    }, { status: 403 })), /no active laboratory profile/)
})

test('only an active profile belonging to the signed-in user can complete the account check', async () => {
    const profile = { id: 'test-user', role: 'student', is_active: true }

    const result = await loadAccount(session, undefined, async (url, options) => {
        assert.equal(url, '/api/auth/me')

        assert.equal(options.headers.Authorization, 'Bearer test-token')

        return Response.json({ user: session.user, profile })
    })

    assert.deepEqual(result, profile)

    for (const invalid of [null, { ...profile, id: 'another-user' }, { ...profile, role: 'owner' }, { ...profile, is_active: false }]) {
        await assert.rejects(loadAccount(session, undefined, async () => Response.json({
            user: session.user,
            profile: invalid,
        })), /invalid account profile/)
    }
})

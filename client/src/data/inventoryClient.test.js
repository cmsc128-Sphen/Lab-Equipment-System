import test from 'node:test'

import assert from 'node:assert/strict'

import { fetchInventory, toBookingItem } from './inventoryClient.js'

function item(id, type = 'equipment', available = 1800) {
    return {
        id, code: `CODE-${id}`, name: id, nameLower: id, categoryName: 'Glassware',
        unit: type === 'chemical' ? 'mL' : 'pcs', type, quantityScale: 100, isActive: true,
        stock: { total: available, available, reserved: 0, checkedOut: 0, unusable: 0 },
    }
}

function page(items, total = items.length, pageNumber = 1, truncated = false) {
    return { items, total, page: pageNumber, limit: 200, truncated }
}

test('page loader sends the session token and preserves database quantities for display', async () => {
    const result = await fetchInventory({
        getAccessToken: async () => 'test-token',
        fetchImpl: async (url, options) => {
            assert.equal(url, '/api/items?page=1&limit=200')

            assert.equal(options.headers.Authorization, 'Bearer test-token')

            assert.equal(options.cache, 'no-store')

            return new Response(JSON.stringify(page([item('ethanol', 'chemical', 240025)])))
        },
    })

    assert.equal(result.items[0].stock.available, 240025)

    assert.equal(toBookingItem(result.items[0]).available, 2400.25)

    assert.equal(toBookingItem(item('beaker')).available, 18)

    assert.equal(toBookingItem(item('gloves', 'disposable')).category, 'equipment')
})

test('every catalogue page is fetched before returning data for search and filtering', async () => {
    const first = Array.from({ length: 200 }, (_, index) => item(`item-${index}`))

    const pages = [page(first, 201, 1, true), page([item('last-item')], 201, 2)]

    const calls = []

    const result = await fetchInventory({
        getAccessToken: async () => 'token',
        fetchImpl: async (url) => {
            calls.push(url)

            return new Response(JSON.stringify(pages.shift()))
        },
    })

    assert.equal(result.items.length, 201)

    assert.equal(result.items.at(-1).id, 'last-item')

    assert.equal(result.truncated, false)

    assert.deepEqual(calls, ['/api/items?page=1&limit=200', '/api/items?page=2&limit=200'])
})

test('missing sessions and failed requests never fall back to local mock inventory', async () => {
    await assert.rejects(fetchInventory({
        getAccessToken: async () => null,
        fetchImpl: () => assert.fail('Missing sessions must not send a request'),
    }), /signed in/)

    for (const status of [401, 403, 503]) {
        await assert.rejects(fetchInventory({
            getAccessToken: async () => 'token',
            fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'Account or inventory unavailable' } }), { status }),
        }), /Account or inventory unavailable/)
    }

    await assert.rejects(fetchInventory({
        getAccessToken: async () => 'token',
        fetchImpl: async () => { throw new TypeError('Failed to fetch') },
    }), /Check your connection/)
})

test('empty inventory succeeds and cancelled pages stop loading', async () => {
    const result = await fetchInventory({
        getAccessToken: async () => 'token',
        fetchImpl: async () => new Response(JSON.stringify(page([]))),
    })

    assert.deepEqual(result, { items: [], truncated: false })

    const controller = new AbortController()

    controller.abort()

    await assert.rejects(fetchInventory({
        signal: controller.signal,
        getAccessToken: () => assert.fail('Cancelled pages must not load a session'),
    }), { name: 'AbortError' })
})

test('partial, oversized and invalid catalogues are rejected instead of becoming incomplete search results', async () => {
    const responses = [
        {},
        page([item('one')], 2),
        page([], 2, 1, true),
        page([item('one')], 5001, 1, true),
        page([item('same'), item('same')]),
        page([{ ...item('unsafe'), stock: { ...item('unsafe').stock, available: Number.MAX_SAFE_INTEGER + 1 } }]),
        page([{ ...item('inactive'), isActive: false }]),
    ]

    for (const response of responses) {
        await assert.rejects(fetchInventory({
            getAccessToken: async () => 'token',
            fetchImpl: async () => new Response(JSON.stringify(response)),
        }))
    }

    // A changing total means offset pagination no longer describes a stable catalogue.
    const pages = [page([item('first')], 2, 1, true), page([item('second')], 3, 2)]

    await assert.rejects(fetchInventory({
        getAccessToken: async () => 'token',
        fetchImpl: async () => new Response(JSON.stringify(pages.shift())),
    }), /changed while loading/)
})

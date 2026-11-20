import test from 'node:test'

import assert from 'node:assert/strict'

import { createAdminBookingClient, toAdminBooking } from './adminBookings.js'

function bookingRow(id = 'request-one') {
    return {
        id, request_no: 'REQ-2026-1', status: 'pending', updated_at: '2026-11-20T10:00:00.123456+00:00',
        created_at: '2026-11-20T10:00:00Z', borrow_date: '2026-11-22', return_date: '2026-11-22',
        requester_snapshot: { name: 'Demo Student', id_number: 'MOCK-001', email: 'demo@example.invalid', requester_type: 'undergraduate' },
        subject: 'Chemistry', purpose: 'Experiment', staff_notes: '', denial_reason: null,
        lines: [{ id: 'line-one', item_name: 'Ethanol', unit: 'mL', quantity_scale: 100, qty_requested: 15050, qty_approved: 0,
            item: { available: 240025, is_active: true, category: { name: 'Chemicals', is_active: true } } }],
    }
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

test('database hundredths become human quantities and reviewed allocations survive reload', () => {
    // Pending requests start with the available requested quantity; reviewed requests use saved allocation.
    const row = bookingRow()

    assert.equal(toAdminBooking(row).items[0].requested, 150.5)

    assert.equal(toAdminBooking(row).items[0].stock, 2400.25)

    assert.equal(toAdminBooking({ ...row, status: 'approved', lines: [{ ...row.lines[0], qty_approved: 10025 }] }).items[0].allocated, 100.25)

    row.lines[0].item.is_active = false

    assert.equal(toAdminBooking(row).items[0].allocated, 0)
})

test('all queue pages load with a user token before search and filtering can use them', async () => {
    const calls = []

    const client = createAdminBookingClient({
        getAccessToken: async () => 'user-session',
        fetchImpl: async (url, options) => {
            calls.push({ url, options })

            const page = Number(new URL(url, 'http://local').searchParams.get('page'))

            return json({ bookings: page === 1 ? Array.from({ length: 200 }, (_, index) => bookingRow(`request-${index}`)) : [bookingRow('request-last')], total: 201, page, truncated: page === 1 })
        },
    })

    assert.equal((await client.load()).length, 201)

    assert.equal(calls.length, 2)

    assert.equal(calls[0].options.headers.Authorization, 'Bearer user-session')
})

test('incomplete queues and upstream errors never fall back to demo bookings', async () => {
    // A short final page must be reported as a failure, not a valid partial queue.
    const client = createAdminBookingClient({
        getAccessToken: async () => 'session',
        fetchImpl: async () => json({ bookings: [bookingRow()], page: 1, total: 2, truncated: false }),
    })

    await assert.rejects(client.load(), /completely/)

    const forbidden = createAdminBookingClient({ getAccessToken: async () => 'session', fetchImpl: async () => json({ error: { message: 'Staff only' } }, 403) })

    await assert.rejects(forbidden.load(), /Staff only/)
})

test('decision writes preserve the version and scale chemical allocations exactly once', async () => {
    let payload

    const client = createAdminBookingClient({
        getAccessToken: async () => 'session',
        fetchImpl: async (_url, options) => {
            payload = JSON.parse(options.body)

            return new Response(null, { status: 204 })
        },
    })

    const booking = toAdminBooking(bookingRow())

    booking.items[0].allocated = 150.5

    await client.decide(booking, 'approved')

    assert.equal(payload.allocations[0].quantity, 15050)

    assert.equal(payload.updatedAt, booking.updatedAt)

    booking.items[0].unit = 'pcs'

    await assert.rejects(client.decide(booking, 'approved'), /whole quantities/)
})

test('missing sessions do not issue an unauthorized fetch', async () => {
    let calls = 0

    const client = createAdminBookingClient({ getAccessToken: async () => null, fetchImpl: async () => { calls += 1 } })

    await assert.rejects(client.load(), /Sign in again/)

    assert.equal(calls, 0)
})

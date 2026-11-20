export const bookingStatuses = {
    pending: 'Pending',
    approved: 'Approved',
    ready: 'Ready for pickup',
    denied: 'Disapproved',
    cancelled: 'Cancelled',
    claimed: 'Claimed',
    return_pending: 'Return pending',
    closed: 'Closed',
}

function quantity(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('A booking contains an invalid quantity. Contact lab staff.')
    }

    return value / 100
}

export function toAdminBooking(row) {
    const snapshot = row.requester_snapshot

    if (!snapshot || !['name', 'id_number', 'email', 'requester_type'].every((key) => typeof snapshot[key] === 'string')
        || typeof row.id !== 'string' || typeof row.request_no !== 'string' || typeof row.updated_at !== 'string'
        || !bookingStatuses[row.status] || !Array.isArray(row.lines)) {
        throw new Error('The booking API returned an invalid request.')
    }

    const submittedAt = new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
    }).format(new Date(row.created_at))

    return {
        id: row.id,
        requestNumber: row.request_no,
        updatedAt: row.updated_at,
        studentName: snapshot.name,
        studentNumber: snapshot.id_number,
        email: snapshot.email,
        category: snapshot.requester_type,
        submittedAt,
        pickupAt: row.borrow_date,
        pickupLabel: row.borrow_date,
        returnAt: row.return_date,
        purpose: `${row.subject} · ${row.purpose}`,
        status: bookingStatuses[row.status],
        staffNotes: row.staff_notes || '',
        denialReason: row.denial_reason || '',
        items: row.lines.map((line) => {
            if (line.quantity_scale !== 100 || !line.item || !line.item.category) {
                throw new Error('A booking item could not be loaded. Refresh bookings.')
            }

            const requested = quantity(line.qty_requested)

            const stock = line.item.is_active && line.item.category.is_active ? quantity(line.item.available) : 0

            return {
                id: line.id,
                name: line.item_name,
                category: line.item.category.name,
                unit: line.unit,
                requested,
                stock,
                allocated: row.status === 'pending' ? Math.min(requested, stock) : quantity(line.qty_approved),
            }
        }),
    }
}

export function createAdminBookingClient({ getAccessToken, fetchImpl = fetch }) {
    async function request(path, options = {}) {
        const token = await getAccessToken()

        if (!token) throw new Error('Sign in again to review bookings.')

        const timeout = AbortSignal.timeout(25000)

        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

        let response

        try {
            response = await fetchImpl(`/api/admin/bookings${path}`, {
                ...options,
                signal,
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            })
        } catch (error) {
            if (options.signal?.aborted) throw error

            throw new Error('Could not reach the booking API. Refresh bookings before trying again.')
        }

        if (response.status === 204) return null

        const result = await response.json().catch(() => null)

        if (!response.ok) throw new Error(result?.error?.message || 'Unable to load or save the booking. Refresh and try again.')

        return result
    }

    return {
        async load({ signal } = {}) {
            const bookings = []

            const seen = new Set()

            let total = null

            for (let page = 1; page <= 25; page += 1) {
                const result = await request(`?page=${page}`, { signal })

                if (!Array.isArray(result?.bookings) || !Number.isSafeInteger(result.total)
                    || result.total < 0 || result.total > 5000 || result.page !== page
                    || typeof result.truncated !== 'boolean' || (total !== null && total !== result.total)) {
                    throw new Error('The booking queue changed or could not be loaded completely. Refresh bookings.')
                }

                total = result.total

                for (const row of result.bookings) {
                    if (seen.has(row.id)) throw new Error('The booking queue changed. Refresh bookings.')

                    seen.add(row.id)

                    bookings.push(toAdminBooking(row))
                }

                if (!result.truncated && bookings.length === total) return bookings

                if (!result.bookings.length || !result.truncated) break
            }

            throw new Error('The booking queue could not be loaded completely. Refresh bookings.')
        },

        async decide(booking, action) {
            const allocations = booking.items.map((item) => {
                const scaled = item.allocated * 100

                const rounded = Math.round(scaled)

                if (!Number.isFinite(scaled) || Math.abs(scaled - rounded) > 0.0001
                    || !Number.isSafeInteger(rounded) || rounded < 0
                    || (item.unit === 'pcs' && rounded % 100 !== 0)) {
                    throw new Error('Use whole quantities for pieces and at most two decimal places for chemicals.')
                }

                return { id: item.id, quantity: rounded }
            })

            return request(`/${booking.id}/decision`, {
                method: 'POST',
                body: JSON.stringify({ action, updatedAt: booking.updatedAt, allocations, staffNotes: booking.staffNotes, denialReason: booking.denialReason }),
            })
        },
    }
}

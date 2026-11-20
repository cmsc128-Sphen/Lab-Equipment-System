const express = require('express');

const { createAuthenticationMiddleware, requireRoles } = require('./auth');

const requestColumns = 'id,request_no,requester_snapshot,subject,purpose,borrow_date,return_date,status,staff_notes,denial_reason,created_at,updated_at';

const lineColumns = 'id,request_id,item_id,item_name,item_type,unit,quantity_scale,qty_requested,qty_approved,item:items(available,is_active,category:categories(name,is_active))';

const decisionErrors = {
    BOOKING_FORBIDDEN: [403, 'Your account cannot review bookings.'],
    BOOKING_NOT_FOUND: [404, 'This booking no longer exists.'],
    BOOKING_CONFLICT: [409, 'This booking has changed. Refresh bookings before reviewing it again.'],
    BOOKING_STOCK_CHANGED: [409, 'Stock has changed or an item is inactive. Refresh bookings and check allocations.'],
    BOOKING_INVALID: [400, 'Check the decision and item quantities.'],
    BOOKING_REASON_REQUIRED: [400, 'Enter a reason for disapproval.'],
    BOOKING_ALLOCATION_REQUIRED: [400, 'Allocate at least one item before approving.'],
};

function createBookingsRouter(authenticate = createAuthenticationMiddleware()) {
    const router = express.Router();

    router.use('/admin/bookings', authenticate, requireRoles('admin', 'lab_aid'));

    router.get('/admin/bookings', async (request, response) => {
        const pageText = request.query.page ?? '1';

        const page = Number(pageText);

        if (typeof pageText !== 'string' || !/^\d+$/.test(pageText) || !Number.isInteger(page)
            || page < 1 || page > 25 || Object.keys(request.query).some((key) => key !== 'page')) {
            return response.status(400).json({ error: { code: 'INVALID_PAGE', message: 'Use page 1–25.' } });
        }

        // INFO before reading the staff queue; page contains no borrower information.
        console.log(`[INFO] bookings.fetch_started page=${page}`);

        try {
            const signal = AbortSignal.timeout(20000);

            const { data, count, error } = await request.auth.supabase.from('requests')
                .select(requestColumns, { count: 'exact' })
                .order('created_at', { ascending: false }).order('id')
                .range((page - 1) * 200, page * 200 - 1).abortSignal(signal);

            if (error || !Array.isArray(data) || !Number.isSafeInteger(count)) throw new Error('Queue unavailable');

            const lines = [];

            if (data.length) {
                // Fetch line items separately so PostgREST's row cap cannot silently truncate a booking.
                for (let offset = 0; ; offset += 200) {
                    const result = await request.auth.supabase.from('request_items')
                        .select(lineColumns, { count: 'exact' }).in('request_id', data.map((row) => row.id))
                        .order('id').range(offset, offset + 199).abortSignal(signal);

                    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count)
                        || result.count > 10000) throw new Error('Lines unavailable');

                    lines.push(...result.data);

                    if (lines.length === result.count) break;

                    if (!result.data.length || lines.length > result.count) throw new Error('Lines changed');
                }
            }

            const bookings = data.map((row) => ({ ...row, lines: lines.filter((line) => line.request_id === row.id) }));

            // INFO after all rows have loaded, including valid empty queues.
            console.log(`[INFO] bookings.fetch_completed count=${bookings.length} total=${count}`);

            return response.json({ bookings, total: count, page, truncated: page * 200 < count });
        } catch {
            // ERROR on upstream failure; omit private borrower/provider details and allow retry.
            console.error('[ERROR] bookings.fetch_failed nextAction=retry');

            return response.status(503).json({ error: { code: 'BOOKINGS_UNAVAILABLE', message: 'Unable to load bookings. Please try again.' } });
        }
    });

    router.post('/admin/bookings/:id/decision', async (request, response) => {
        const { action, updatedAt, allocations, staffNotes = '', denialReason = '' } = request.body || {};

        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const validAllocations = Array.isArray(allocations) && allocations.length <= 1000
            && allocations.every((line) => line && uuid.test(line.id) && Number.isSafeInteger(line.quantity) && line.quantity >= 0);

        if (!uuid.test(request.params.id) || !['approved', 'denied', 'ready'].includes(action)
            || typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))
            || typeof staffNotes !== 'string' || staffNotes.length > 2000
            || typeof denialReason !== 'string' || denialReason.length > 2000
            || (action === 'approved' && !validAllocations)) {
            return response.status(400).json({ error: { code: 'BOOKING_INVALID', message: 'Check the decision and item quantities.' } });
        }

        // INFO before the atomic RPC; action is a validated status, never free-form user content.
        console.log(`[INFO] bookings.decision_started action=${action}`);

        try {
            const { error } = await request.auth.supabase.rpc('review_booking', {
                p_request_id: request.params.id,
                p_expected_updated_at: updatedAt,
                p_action: action,
                p_allocations: action === 'approved' ? allocations : [],
                p_staff_notes: staffNotes,
                p_denial_reason: denialReason,
            }).abortSignal(AbortSignal.timeout(15000));

            if (error) {
                const known = decisionErrors[error.message];

                if (!known) throw new Error('Decision unavailable');

                // WARN for a rejected decision; caller must refresh or correct its input.
                console.warn(`[WARN] bookings.decision_rejected code=${error.message} nextAction=refresh_or_correct`);

                return response.status(known[0]).json({ error: { code: error.message, message: known[1] } });
            }

            // INFO only after the database commits the decision and stock changes.
            console.log(`[INFO] bookings.decision_completed action=${action} email=unavailable`);

            return response.status(204).end();
        } catch {
            // ERROR for uncertain upstream outcomes; refreshing is required before retrying.
            console.error('[ERROR] bookings.decision_failed nextAction=refresh_before_retry');

            return response.status(503).json({ error: { code: 'DECISION_UNAVAILABLE', message: 'Unable to confirm the decision. Refresh bookings before trying again.' } });
        }
    });

    return router;
}

module.exports = { createBookingsRouter };

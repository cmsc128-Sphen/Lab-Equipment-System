const express = require('express');

const { createAuthenticationMiddleware, requireRoles } = require('./auth');

const requestColumns = 'id,request_no,requester_snapshot,subject,purpose,borrow_date,return_date,status,staff_notes,denial_reason,created_at,updated_at';

const lineColumns = 'id,request_id,item_id,item_name,item_type,unit,quantity_scale,qty_requested,qty_approved,item:items(available,is_active,category:categories(name,is_active))';

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
                .eq('status', 'pending')
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
        return response.status(501).json({
            error: {
                code: 'BOOKING_DECISIONS_DEFERRED',
                message: 'Booking decisions are not available in the Pending queue.',
            },
        });
    });

    return router;
}

module.exports = { createBookingsRouter };

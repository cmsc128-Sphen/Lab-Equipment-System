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

const submissionErrors = {
    BOOKING_FORBIDDEN: [403, 'Only active student accounts can submit booking requests.'],
    BOOKING_INVALID: [400, 'The request could not be read. Reload the page and try again.'],
    BOOKING_DETAILS_INVALID: [400, 'Enter a subject and purpose.'],
    BOOKING_DATES_INVALID: [400, 'Choose a borrowing date from today onward and a return date on or after it.'],
    BOOKING_ITEMS_INVALID: [400, 'Check your items: each needs a valid quantity and may only appear once.'],
    BOOKING_ITEM_UNAVAILABLE: [409, 'An item is no longer available. Reload the page to update your request.'],
    BOOKING_STOCK_EXCEEDED: [409, 'An item no longer has enough stock. Reload the page and lower the quantity.'],
    BOOKING_SUBMISSION_CONFLICT: [409, 'This submission key was already used for a different request. Keep the same key for an unchanged retry; use a new key for a new draft.'],
};

const submissionStatuses = {
    pending: 'Pending', approved: 'Approved', ready: 'Ready for pickup', denied: 'Disapproved',
    cancelled: 'Cancelled', claimed: 'Claimed', return_pending: 'Return pending', closed: 'Closed',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validCalendarDate(value) {
    if (typeof value !== 'string' || !datePattern.test(value) || value.startsWith('0000')) return false;

    const date = new Date(`${value}T12:00:00Z`);

    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Shape checks only; the database function owns the authoritative rules.
function validSubmission(body) {
    const { submissionKey, subject, purpose, borrowDate, returnDate, items } = body || {};

    return typeof submissionKey === 'string' && uuidPattern.test(submissionKey)
        && typeof subject === 'string' && subject.length <= 200
        && typeof purpose === 'string' && purpose.length <= 2000
        && validCalendarDate(borrowDate) && validCalendarDate(returnDate)
        && Array.isArray(items) && items.length >= 1 && items.length <= 100
        && items.every((item) => item && typeof item.inventoryId === 'string' && uuidPattern.test(item.inventoryId)
            && Number.isSafeInteger(item.quantity) && item.quantity > 0);
}

function createBookingsRouter(authenticate = createAuthenticationMiddleware()) {
    const router = express.Router();

    router.use('/admin/bookings', authenticate, requireRoles('admin', 'lab_aid'));

    router.use('/bookings', authenticate, requireRoles('student'));

    router.post('/bookings', async (request, response) => {
        if (!validSubmission(request.body)) {
            return response.status(400).json({ error: { code: 'BOOKING_INVALID', message: submissionErrors.BOOKING_INVALID[1] } });
        }

        const { submissionKey, subject, purpose, borrowDate, returnDate, items } = request.body;

        // INFO before the atomic RPC; only the line count is logged, never borrower details.
        console.log(`[INFO] bookings.submit_started lines=${items.length}`);

        try {
            const { data, error } = await request.auth.supabase.rpc('submit_booking', {
                p_submission_key: submissionKey,
                p_subject: subject,
                p_purpose: purpose,
                p_borrow_date: borrowDate,
                p_return_date: returnDate,
                p_items: items.map(({ inventoryId, quantity }) => ({ inventoryId, quantity })),
            }).abortSignal(AbortSignal.timeout(15000));

            if (error) {
                const known = submissionErrors[error.message];

                if (!known) throw new Error('Submission unavailable');

                // WARN for a rejected submission; nothing was saved and the student can correct it.
                console.warn(`[WARN] bookings.submit_rejected code=${error.message} nextAction=correct`);

                return response.status(known[0]).json({ error: { code: error.message, message: known[1] } });
            }

            if (!data || typeof data.reference !== 'string' || !uuidPattern.test(data.id)
                || !Object.hasOwn(submissionStatuses, data.status) || typeof data.replayed !== 'boolean'
                || typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt))
                || (!data.replayed && data.status !== 'pending')) throw new Error('Unexpected result');

            // INFO only after the database commits the header and lines.
            console.log(`[INFO] bookings.submit_completed replayed=${Boolean(data.replayed)}`);

            return response.status(data.replayed ? 200 : 201).json({
                id: data.id, reference: data.reference, status: submissionStatuses[data.status], createdAt: data.createdAt,
            });
        } catch {
            // ERROR for uncertain outcomes; retrying with the same submission key cannot save twice.
            console.error('[ERROR] bookings.submit_failed nextAction=retry_same_key');

            return response.status(503).json({ error: { code: 'SUBMISSION_UNAVAILABLE', message: 'Unable to confirm your request was saved. Try submitting again; it will not be saved twice.' } });
        }
    });

    router.get('/bookings', async (request, response) => {
        const pageText = request.query.page ?? '1';

        const page = Number(pageText);

        if (typeof pageText !== 'string' || !/^\d+$/.test(pageText)
            || !Number.isSafeInteger(page) || page < 1 || page > 10000
            || Object.keys(request.query).some((key) => key !== 'page')) {
            return response.status(400).json({ error: { code: 'INVALID_PAGE', message: 'Use page 1–10000.' } });
        }

        // INFO before an owner-scoped query; only pagination is logged.
        console.log(`[INFO] bookings.student_list_started page=${page}`);

        try {
            const { data, count, error } = await request.auth.supabase.from('requests')
                .select(requestColumns, { count: 'exact' }).eq('requester_id', request.auth.user.id)
                .order('created_at', { ascending: false }).order('id')
                .range((page - 1) * 20, page * 20 - 1).abortSignal(AbortSignal.timeout(10000));

            if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) throw new Error('History unavailable');

            // INFO after the student's page is loaded; an empty result is valid.
            console.log(`[INFO] bookings.student_list_completed count=${data.length} total=${count}`);

            return response.json({ requests: data, total: count, page, limit: 20, truncated: page * 20 < count });
        } catch {
            // ERROR on upstream failure; no borrower or provider details are exposed.
            console.error('[ERROR] bookings.student_list_failed nextAction=retry');

            return response.status(503).json({ error: { code: 'BOOKINGS_UNAVAILABLE', message: 'Unable to load your requests. Please try again.' } });
        }
    });

    router.get('/bookings/:id', async (request, response) => {
        if (!uuidPattern.test(request.params.id) || Object.keys(request.query).length) {
            return response.status(400).json({ error: { code: 'BOOKING_INVALID', message: 'Use a valid request ID without query parameters.' } });
        }

        // INFO before looking up an owned receipt; IDs and borrower data are omitted.
        console.log('[INFO] bookings.student_detail_started');

        try {
            const signal = AbortSignal.timeout(10000);

            const { data, error } = await request.auth.supabase.from('requests')
                .select(requestColumns).eq('id', request.params.id)
                .eq('requester_id', request.auth.user.id).maybeSingle().abortSignal(signal);

            if (error) throw new Error('Receipt unavailable');

            if (!data) {
                // INFO for missing or other-owner records; both deliberately return the same 404.
                console.log('[INFO] bookings.student_detail_not_found');

                return response.status(404).json({ error: { code: 'BOOKING_NOT_FOUND', message: 'Request not found.' } });
            }

            const lines = await request.auth.supabase.from('request_items')
                .select('id,item_id,item_code,item_name,item_type,unit,quantity_scale,return_policy,qty_requested,qty_approved,aid_remark', { count: 'exact' })
                .eq('request_id', data.id).order('id').range(0, 999).abortSignal(signal);

            if (lines.error || !Array.isArray(lines.data) || lines.data.length !== lines.count) throw new Error('Incomplete receipt');

            // INFO after the complete saved request and lines have loaded.
            console.log(`[INFO] bookings.student_detail_completed lines=${lines.data.length}`);

            return response.json({ request: { ...data, items: lines.data } });
        } catch {
            // ERROR for failed or truncated reads; never return a partial receipt.
            console.error('[ERROR] bookings.student_detail_failed nextAction=retry');

            return response.status(503).json({ error: { code: 'BOOKINGS_UNAVAILABLE', message: 'Unable to load your request. Please try again.' } });
        }
    });

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

const express = require('express');

const { createAuthenticationMiddleware } = require('./auth');

const inventoryColumns = [
    'id', 'code', 'name', 'name_lower', 'specification', 'type', 'category_id',
    'unit', 'quantity_scale', 'total', 'available', 'reserved', 'checked_out',
    'unusable', 'status', 'location', 'tags', 'chemical', 'is_active', 'created_at', 'updated_at',
    'category:categories!items_category_id_type_fkey!inner(name,is_active)',
].join(',');

function toInventoryItem(row) {
    const stock = {
        total: row.total,
        available: row.available,
        reserved: row.reserved,
        checkedOut: row.checked_out,
        unusable: row.unusable,
    };

    if (row.quantity_scale !== 100 || !Object.values(stock).every((quantity) => Number.isSafeInteger(quantity) && quantity >= 0)) {
        throw new Error('Inventory quantities are invalid.');
    }

    const searchText = [row.name, row.code, row.specification, row.category.name,
        ...(row.tags || []), JSON.stringify(row.chemical || {})].join(' ').toLowerCase();

    // Keep the current pages' camelCase contract; quantities remain integer hundredths.
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        nameLower: row.name_lower,
        specification: row.specification,
        type: row.type,
        categoryId: row.category_id,
        categoryName: row.category.name,
        unit: row.unit,
        quantityScale: row.quantity_scale,
        stock,
        status: row.status,
        location: row.location,
        tags: row.tags,
        chemical: row.chemical,
        searchText,
        isActive: row.is_active,
        primaryImage: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function createInventoryRouter(authenticate = createAuthenticationMiddleware()) {
    const router = express.Router();

    router.get('/items', authenticate, async (request, response) => {
        const pageText = request.query.page ?? '1';

        const limitText = request.query.limit ?? '200';

        const page = Number(pageText);

        const limit = Number(limitText);

        const validQuery = typeof pageText === 'string' && /^\d+$/.test(pageText)
            && typeof limitText === 'string' && /^\d+$/.test(limitText)
            && Number.isInteger(page) && page >= 1 && page <= 10000
            && Number.isInteger(limit) && limit >= 1 && limit <= 200
            && Object.keys(request.query).every((key) => ['page', 'limit'].includes(key));

        if (!validQuery) {
            return response.status(400).json({
                error: { code: 'INVALID_PAGINATION', message: 'Use page 1–10000 and limit 1–200.' },
            });
        }

        const offset = (page - 1) * limit;

        // INFO before the user-scoped query; pagination contains no private user data.
        console.log(`[INFO] inventory.fetch_started page=${page} limit=${limit}`);

        try {
            const { data, count, error } = await request.auth.supabase
                .from('items')
                .select(inventoryColumns, { count: 'exact' })
                .eq('is_active', true)
                .eq('category.is_active', true)
                .order('name_lower')
                .order('id')
                .range(offset, offset + limit - 1)
                .abortSignal(AbortSignal.timeout(10000));

            if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) {
                throw new Error('The catalogue could not be retrieved.');
            }

            const items = data.map(toInventoryItem);

            // INFO after retrieval; zero items is a valid empty catalogue/page.
            console.log(`[INFO] inventory.fetch_completed page=${page} count=${items.length} total=${count}`);

            return response.json({ items, total: count, page, limit, truncated: offset + items.length < count });
        } catch {
            // ERROR on query/validation failure; omit provider messages and allow a later retry.
            console.error('[ERROR] inventory.fetch_failed nextAction=return_error');

            return response.status(503).json({
                error: { code: 'INVENTORY_UNAVAILABLE', message: 'Unable to load inventory. Please try again.' },
            });
        }
    });

    return router;
}

module.exports = { createInventoryRouter };

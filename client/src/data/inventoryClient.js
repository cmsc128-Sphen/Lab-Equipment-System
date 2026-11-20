const pageSize = 200

const maximumCatalogueSize = 5000

function validateItem(item) {
    const validText = item && ['id', 'code', 'name', 'nameLower', 'categoryName', 'unit']
        .every((field) => typeof item[field] === 'string' && item[field].length > 0)

    const validStock = item?.stock && ['total', 'available', 'reserved', 'checkedOut', 'unusable']
        .every((field) => Number.isSafeInteger(item.stock[field]) && item.stock[field] >= 0)

    if (!validText || !validStock || item.quantityScale !== 100 || item.isActive !== true
        || !['equipment', 'chemical', 'disposable'].includes(item.type)) {
        throw new Error('The inventory API returned an invalid item.')
    }
}

export async function fetchInventory({ getAccessToken, fetchImpl = fetch, signal }) {
    signal?.throwIfAborted()

    const token = await getAccessToken()

    if (!token) {
        throw new Error('You must be signed in to load inventory.')
    }

    const items = []

    const seenIds = new Set()

    let expectedTotal = null

    for (let page = 1; ; page += 1) {
        signal?.throwIfAborted()

        const timeout = AbortSignal.timeout(15000)

        const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout

        let response

        try {
            response = await fetchImpl(`/api/items?page=${page}&limit=${pageSize}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: requestSignal,
                cache: 'no-store',
            })
        } catch (error) {
            if (signal?.aborted) {
                throw error
            }

            throw new Error('Unable to load inventory. Check your connection and try again.')
        }

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.error?.message || 'Unable to load inventory. Please try again.')
        }

        const validPage = result && Array.isArray(result.items)
            && Number.isSafeInteger(result.total) && result.total >= 0
            && result.page === page && result.limit === pageSize
            && typeof result.truncated === 'boolean' && result.items.length <= pageSize

        if (!validPage) {
            throw new Error('The inventory API returned an invalid response.')
        }

        if (result.total > maximumCatalogueSize) {
            throw new Error('The catalogue is too large to load completely. Contact lab staff.')
        }

        if (expectedTotal !== null && result.total !== expectedTotal) {
            throw new Error('Inventory changed while loading. Refresh the page and try again.')
        }

        expectedTotal = result.total

        for (const item of result.items) {
            validateItem(item)

            if (seenIds.has(item.id)) {
                throw new Error('Inventory changed while loading. Refresh the page and try again.')
            }

            seenIds.add(item.id)

            items.push(item)
        }

        if (!result.truncated) {
            if (items.length !== expectedTotal) {
                throw new Error('Inventory could not be loaded completely. Refresh the page and try again.')
            }

            // Search and filtering in the pages operate on this complete catalogue.
            return { items, truncated: false }
        }

        if (result.items.length === 0 || items.length >= expectedTotal) {
            throw new Error('The inventory API returned inconsistent pagination.')
        }
    }
}

export function toBookingItem(item) {
    return {
        id: item.id,
        name: item.name,
        category: item.type === 'chemical' ? 'chemical' : 'equipment',
        categoryName: item.categoryName,
        unit: item.unit,
        available: item.stock.available / item.quantityScale,
    }
}

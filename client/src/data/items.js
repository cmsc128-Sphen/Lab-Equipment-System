import { getIdToken } from '../auth/getIdToken.js'
import { mockItems } from './mockItems.js'

const USE_MOCK_DATA = import.meta.env.USE_MOCK_DATA === 'true'

/*
 * GET /api/items returns { items, truncated } for active items, ordered by
 * nameLower then id, with at most 200 results. Items include id (the Firestore
 * document ID), code, name, nameLower, type, categoryId, categoryName, unit,
 * quantityScale, stock (total, available, reserved, checkedOut, unusable),
 * status, searchText, isActive, primaryImage, and chemical. Optional
 * createdAt/updatedAt timestamps are ISO 8601 strings in JSON.
 * The API returns 401 when the bearer token is missing or invalid and 403
 * when the authenticated user's profile is inactive.
 */
export async function getItems() {
  if (USE_MOCK_DATA) {
    return { items: normalizeItems(mockItems), truncated: false }
  }

  const token = await getIdToken()
  if (!token) {
    throw new Error('You must be signed in to load inventory.')
  }

  const response = await fetch('/api/items', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load inventory (${response.status}).`)
  }

  const result = await response.json()
  if (!Array.isArray(result.items) || typeof result.truncated !== 'boolean') {
    throw new Error('The inventory API returned an invalid response.')
  }

  return { items: normalizeItems(result.items), truncated: result.truncated }
}

function normalizeItems(items) {
  return items
    .filter((item) => item.isActive)
    .sort(
      (left, right) =>
        left.nameLower.localeCompare(right.nameLower) ||
        left.id.localeCompare(right.id),
    )
}

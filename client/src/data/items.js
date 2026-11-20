import { getIdToken } from '../auth/getIdToken.js'

import { fetchInventory } from './inventoryClient.js'

// Load the complete authorized catalogue before the pages apply search and filters.
export function getItems({ signal } = {}) {
    return fetchInventory({ getAccessToken: getIdToken, signal })
}

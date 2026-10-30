// Firestore creates a collection when its first document is written.
module.exports = Object.freeze({
    USERS: 'users',

    // Inventory and its catalogue metadata.
    CATEGORIES: 'categories',
    ITEMS: 'items',
    ITEM_IMAGES: 'item_images', // Reserved for later; no Storage setup.

    // Borrowing records and background processing.
    REQUESTS: 'requests',
    STOCK_MOVEMENTS: 'stock_movements',
    NOTIFICATIONS: 'notifications',

    // Internal numbering and uniqueness records.
    COUNTERS: 'counters',
    UNIQUE_KEYS: 'unique_keys',
});

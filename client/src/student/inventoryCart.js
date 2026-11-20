const STORAGE_KEY = 'lab-equipment-student-cart'

function storageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Sign in before using the booking cart.')
  }

  return `${STORAGE_KEY}:${encodeURIComponent(userId)}`
}

function getStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('Cart storage is unavailable in this browser.')
  }
  return storage
}

function getRemovableStorage(storage) {
  if (!storage || typeof storage.removeItem !== 'function') {
    throw new Error('Cart storage is unavailable in this browser.')
  }
  return storage
}

function isCartItem(item) {
  return item &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.category === 'string' &&
    typeof item.categoryName === 'string' &&
    typeof item.unit === 'string' &&
    Number.isFinite(item.available) &&
    typeof item.quantity === 'string'
}

export function readInventoryCart(userId, storage = globalThis.localStorage) {
  const saved = getStorage(storage).getItem(storageKey(userId))
  if (saved === null) return []

  let cart
  try {
    cart = JSON.parse(saved)
  } catch {
    throw new Error('Your saved booking cart is unreadable. Clear its browser storage to start a new cart.')
  }

  if (!Array.isArray(cart) || !cart.every(isCartItem)) {
    throw new Error('Your saved booking cart has an invalid format. Clear its browser storage to start a new cart.')
  }

  return cart
}

export function writeInventoryCart(userId, cart, storage = globalThis.localStorage) {
  if (!Array.isArray(cart) || !cart.every(isCartItem)) {
    throw new TypeError('Cannot save an invalid booking cart.')
  }
  getStorage(storage).setItem(storageKey(userId), JSON.stringify(cart))
}

export function clearInventoryCart(userId, storage = globalThis.localStorage) {
  const cartStorage = getRemovableStorage(storage)
  cartStorage.removeItem(storageKey(userId))
  cartStorage.removeItem(STORAGE_KEY)
}

export function toInventoryCartItem(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.type === 'chemical' ? 'chemical' : 'equipment',
    categoryName: item.categoryName,
    unit: item.unit,
    available: item.stock.available / item.quantityScale,
    quantity: '1',
  }
}

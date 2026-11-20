import assert from 'node:assert/strict'
import test from 'node:test'
import { clearInventoryCart, readInventoryCart, toInventoryCartItem, writeInventoryCart } from './inventoryCart.js'

function createStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

test('cart persists per user and stores data in booking display units', () => {
  const storage = createStorage()
  const userId = 'student-a'
  const item = {
    id: 'ethanol',
    name: 'Ethanol',
    type: 'chemical',
    categoryName: 'Solvents',
    unit: 'mL',
    quantityScale: 100,
    stock: { available: 375 },
  }
  const cart = [toInventoryCartItem(item)]

  writeInventoryCart(userId, cart, storage)

  assert.deepEqual(readInventoryCart(userId, storage), [{
    id: 'ethanol',
    name: 'Ethanol',
    category: 'chemical',
    categoryName: 'Solvents',
    unit: 'mL',
    available: 3.75,
    quantity: '1',
  }])
  assert.deepEqual(readInventoryCart('student-b', storage), [])
})

test('invalid saved cart data fails explicitly', () => {
  const storage = createStorage()
  storage.setItem('lab-equipment-student-cart:student-a', '{')

  assert.throws(() => readInventoryCart('student-a', storage), /saved booking cart is unreadable/)
})

test('cart operations require a signed-in user and ignore the old shared cart key', () => {
  const storage = createStorage()
  storage.setItem('lab-equipment-student-cart', JSON.stringify([{ id: 'old-shared-cart' }]))

  assert.deepEqual(readInventoryCart('student-a', storage), [])
  assert.throws(() => readInventoryCart('', storage), /Sign in before using/)
  assert.throws(() => writeInventoryCart(null, [], storage), /Sign in before using/)
})

test('sign-out cleanup removes only the signed-out user cart', () => {
  const storage = createStorage()
  const cartA = [{ id: 'item-a', name: 'Item A', category: 'equipment', categoryName: 'Glassware', unit: 'pcs', available: 2, quantity: '1' }]
  const cartB = [{ id: 'item-b', name: 'Item B', category: 'equipment', categoryName: 'Glassware', unit: 'pcs', available: 3, quantity: '1' }]
  writeInventoryCart('student-a', cartA, storage)
  writeInventoryCart('student-b', cartB, storage)
  storage.setItem('lab-equipment-student-cart', JSON.stringify(cartA))

  clearInventoryCart('student-a', storage)

  assert.deepEqual(readInventoryCart('student-a', storage), [])
  assert.deepEqual(readInventoryCart('student-b', storage), cartB)
  assert.equal(storage.getItem('lab-equipment-student-cart'), null)
})

test('switching accounts loads only the newly active account cart', () => {
  const storage = createStorage()
  const cartA = [{ id: 'item-a', name: 'Item A', category: 'equipment', categoryName: 'Glassware', unit: 'pcs', available: 2, quantity: '1' }]
  const cartB = [{ id: 'item-b', name: 'Item B', category: 'equipment', categoryName: 'Glassware', unit: 'pcs', available: 3, quantity: '1' }]
  writeInventoryCart('student-a', cartA, storage)
  writeInventoryCart('student-b', cartB, storage)

  assert.deepEqual(readInventoryCart('student-a', storage), cartA)
  assert.deepEqual(readInventoryCart('student-b', storage), cartB)
})

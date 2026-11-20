import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryCart, toInventoryCartItem, writeInventoryCart } from './inventoryCart.js'

function createStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('cart persists across reads and stores data in booking display units', () => {
  const storage = createStorage()
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

  writeInventoryCart(cart, storage)

  assert.deepEqual(readInventoryCart(storage), [{
    id: 'ethanol',
    name: 'Ethanol',
    category: 'chemical',
    categoryName: 'Solvents',
    unit: 'mL',
    available: 3.75,
    quantity: '1',
  }])
})

test('invalid saved cart data fails explicitly', () => {
  const storage = createStorage()
  storage.setItem('lab-equipment-student-cart', '{')

  assert.throws(() => readInventoryCart(storage), /saved booking cart is unreadable/)
})

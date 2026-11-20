import assert from 'node:assert/strict'
import test from 'node:test'
import { getInventoryState } from './inventoryState.js'

test('loading, failed read, empty result and populated inventory are distinct states', () => {
  assert.equal(getInventoryState({ loading: true, error: '', items: [] }), 'loading')
  assert.equal(getInventoryState({ loading: false, error: 'Request failed', items: [] }), 'error')
  assert.equal(getInventoryState({ loading: false, error: '', items: [] }), 'empty')
  assert.equal(getInventoryState({ loading: false, error: '', items: [{ id: 'item-1' }] }), 'ready')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { filterInventoryItems } from './inventoryFilters.js'

const items = [
  { name: 'Beaker', code: 'EQ-01', categoryName: 'Glassware', type: 'equipment', stock: { available: 5 } },
  { name: 'Test tube', code: 'EQ-02', categoryName: 'Glassware', type: 'equipment', stock: { available: 0 } },
  { name: 'Ethanol', code: 'CH-01', categoryName: 'Chemicals', type: 'chemical', stock: { available: 5 } },
]

test('category and availability filters both constrain the search results', () => {
  const results = filterInventoryItems(items, {
    query: 'eQ-',
    category: 'Glassware',
    availability: 'out-of-stock',
  })

  assert.deepEqual(results.map((item) => item.name), ['Test tube'])
})

test('out-of-stock filter retains zero-stock matches', () => {
  const results = filterInventoryItems(items, {
    query: '',
    category: 'All',
    availability: 'out-of-stock',
  })

  assert.deepEqual(results.map((item) => item.name), ['Test tube'])
})

test('result counts represent the combined filtered set', () => {
  const results = filterInventoryItems(items, {
    query: 'glass',
    category: 'Glassware',
    availability: 'in-stock',
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].name, 'Beaker')
})

test('clearing search and filters restores the full inventory result set', () => {
  const filtered = filterInventoryItems(items, {
    query: 'test',
    category: 'Glassware',
    availability: 'out-of-stock',
  })
  const reset = filterInventoryItems(items, {
    query: '',
    category: 'All',
    availability: 'All',
  })

  assert.deepEqual(filtered.map((item) => item.name), ['Test tube'])
  assert.deepEqual(reset, items)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { bookingPayload, recheckErrors, refreshDraft, validateBooking } from './booking.js'
import { createRequestSubmitter } from '../../services/bookingRequests.js'

const form = { studentId: '2026-00001', subject: 'Chemistry 16', purpose: 'Research', borrowDate: '2026-11-01', returnDate: '2026-11-02' }
const equipment = { id: 'beaker', name: 'Beaker', category: 'equipment', quantity: '2', unit: 'pcs', available: 3 }
const chemical = { id: 'salt', name: 'Salt', category: 'chemical', quantity: '0.25', unit: 'g', available: 20 }
const validate = (fields = form, items = [equipment, chemical]) => validateBooking(fields, items, '2026-10-30')

test('accepts whole pcs and up to two-decimal measured quantities', () => {
  assert.deepEqual(validate(), {})
  assert.deepEqual(validate(form, [{ ...chemical, quantity: '0.1' }, { ...chemical, id: 'water', quantity: '19.99' }]), {})
})

test('borrower identity is not validated from the form; it comes from the profile', () => {
  assert.deepEqual(validate({ ...form, studentId: ' ' }), {})
})

test('quantity precision follows the unit, not the item category', () => {
  assert.ok(validate(form, [{ ...chemical, quantity: '0.001' }])['item-salt'])
  assert.ok(validate(form, [{ ...chemical, quantity: '1.255' }])['item-salt'])
  assert.ok(validate(form, [{ ...chemical, unit: 'pcs', quantity: '1.5' }])['item-salt'])
  assert.deepEqual(validate(form, [{ ...chemical, unit: 'pcs', quantity: '2' }]), {})
})

test('rejects empty forms, past/reversed dates and nonexistent calendar dates', () => {
  assert.ok(validate({ ...form, purpose: '' }).purpose)
  assert.ok(validate({ ...form, purpose: 'Other', purposeOther: ' ' }).purposeOther)
  assert.deepEqual(validate({ ...form, purpose: 'Other', purposeOther: 'Science fair' }), {})
  assert.ok(validate({ ...form, borrowDate: '2026-10-29' }).borrowDate)
  assert.ok(validate({ ...form, returnDate: '2026-10-31' }).returnDate)
  assert.ok(validate({ ...form, borrowDate: '2026-02-30' }).borrowDate)
  assert.ok(validate({ ...form, borrowDate: '' }).borrowDate)
})

test('rejects empty selection, duplicate items and invalid quantities', () => {
  assert.ok(validate(form, []).items)
  assert.ok(validate(form, [equipment, equipment]).items)
  for (const quantity of ['', '0', '-1', '1.5', '4', 'Infinity', 'abc']) {
    assert.ok(validate(form, [{ ...equipment, quantity }])['item-beaker'], quantity)
  }
  assert.ok(validate(form, [{ ...chemical, quantity: '21' }])['item-salt'])
})

test('quantity feedback names the specific problem', () => {
  const message = (quantity, item = equipment) => validate(form, [{ ...item, quantity }])[`item-${item.id}`]
  assert.equal(message(''), 'Enter a quantity.')
  assert.equal(message('  '), 'Enter a quantity.')
  assert.equal(message('Infinity'), 'Enter a valid number.')
  assert.equal(message('abc'), 'Enter a valid number.')
  assert.equal(message('0'), 'Enter a quantity greater than zero.')
  assert.equal(message('-2'), 'Enter a quantity greater than zero.')
  assert.equal(message('1.5'), 'Quantities in pcs must be whole numbers.')
  assert.equal(message('0.125', chemical), 'Use at most 2 decimal places.')
  assert.equal(message('4'), 'Only 3 pcs currently available.')
})

test('missing and invalid fields each get their own message', () => {
  const errors = validate({ studentId: '', subject: ' ', purpose: '', borrowDate: '2026-13-01', returnDate: '' }, [])
  assert.deepEqual(errors, {
    subject: 'Enter your subject.',
    purpose: 'Choose the purpose of your request.',
    borrowDate: 'Choose a valid borrowing date.',
    returnDate: 'Choose a valid return date.',
    items: 'Select at least one item.',
  })
})

test('correcting a field clears only the errors that no longer apply', () => {
  const today = '2026-10-30'
  const bad = { ...form, subject: '', purpose: 'Other', purposeOther: '', borrowDate: '2026-11-05', returnDate: '2026-11-02' }
  const errors = validateBooking(bad, [equipment], today)
  assert.deepEqual(Object.keys(errors).sort(), ['purposeOther', 'returnDate', 'subject'])
  // Switching away from Other drops its hidden error; the others stay.
  assert.deepEqual(Object.keys(recheckErrors(errors, { ...bad, purpose: 'Thesis' }, [equipment], today)).sort(), ['returnDate', 'subject'])
  // Moving the borrow date earlier fixes the return-date error without touching the return field.
  assert.deepEqual(Object.keys(recheckErrors(errors, { ...bad, borrowDate: '2026-11-01' }, [equipment], today)).sort(), ['purposeOther', 'subject'])
  // Errors that were not shown are not added while typing.
  assert.deepEqual(recheckErrors({}, bad, [], today), {})
  // Item errors update with the item and clear when it is removed.
  const itemErrors = validateBooking(form, [{ ...equipment, quantity: '0' }], today)
  assert.equal(recheckErrors(itemErrors, form, [{ ...equipment, quantity: '9' }], today)['item-beaker'], 'Only 3 pcs currently available.')
  assert.deepEqual(recheckErrors(itemErrors, form, [chemical], today), {})
})

test('builds a trimmed payload with integer-hundredth quantities and no borrower or unit fields', () => {
  const payload = bookingPayload({ ...form, subject: ' Chemistry 16 ' }, [equipment, chemical])
  assert.equal(payload.subject, 'Chemistry 16')
  assert.equal(bookingPayload({ ...form, purpose: 'Other', purposeOther: ' Science fair ' }, []).purpose, 'Science fair')
  assert.deepEqual(payload.items, [{ inventoryId: 'beaker', quantity: 200 }, { inventoryId: 'salt', quantity: 25 }])
  assert.equal(bookingPayload(form, [{ ...chemical, quantity: '25.5' }]).items[0].quantity, 2550)
  assert.equal(bookingPayload(form, [{ ...chemical, quantity: '0.29' }]).items[0].quantity, 29)
  assert.equal('borrower' in payload, false)
  assert.equal(bookingPayload(form, [equipment], 'key-1').submissionKey, 'key-1')
})

test('refreshing a draft keeps quantities, updates stock and drops missing items', () => {
  const inventory = [{ id: 'beaker', name: 'Beaker 250 mL', category: 'equipment', categoryName: 'Glassware', unit: 'pcs', available: 1 }]
  const { items, removed } = refreshDraft([equipment, chemical], inventory)
  assert.deepEqual(items, [{ ...inventory[0], quantity: '2' }])
  assert.deepEqual(removed, [chemical])
  assert.ok(validateBooking(form, items, '2026-10-30')['item-beaker'], 'stale quantity is checked against current stock')
})

test('API adapter uses the current access token and returns the confirmed response', async () => {
  let sent
  const submit = createRequestSubmitter({ endpoint: '/agreed-endpoint', getAccessToken: async () => 'test-token', fetchImpl: async (url, options) => {
    sent = { url, ...options }
    return new Response(JSON.stringify({ reference: 'REQ-1', status: 'Pending' }), { status: 201 })
  } })
  assert.deepEqual(await submit(bookingPayload(form, [equipment])), { reference: 'REQ-1', status: 'Pending' })
  assert.equal(sent.headers.Authorization, 'Bearer test-token')
  assert.equal(sent.method, 'POST')
})

test('API adapter rejects missing/expired sessions and surfaces server validation', async () => {
  const missing = createRequestSubmitter({ endpoint: '/requests', getAccessToken: async () => null, fetchImpl: () => assert.fail('must not call server') })
  await assert.rejects(missing({}), /session has expired/)
  for (const [status, message] of [[401, 'session has expired'], [422, 'Not enough stock']]) {
    const submit = createRequestSubmitter({ endpoint: '/requests', getAccessToken: async () => 'token', fetchImpl: async () => new Response(JSON.stringify({ message: 'Not enough stock' }), { status }) })
    await assert.rejects(submit({}), new RegExp(message))
  }
  const backend = createRequestSubmitter({ endpoint: '/api/bookings', getAccessToken: async () => 'token', fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'BOOKING_STOCK_EXCEEDED', message: 'An item no longer has enough stock.' } }), { status: 409 }) })
  await assert.rejects(backend({}), /no longer has enough stock/)
})

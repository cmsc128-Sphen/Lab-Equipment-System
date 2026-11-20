export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function validateBooking(form, items, today = localDate()) {
  const errors = {}
  if (!form.subject.trim()) errors.subject = 'Enter your subject.'
  if (!form.purpose) errors.purpose = 'Choose the purpose of your request.'
  else if (form.purpose === 'Other' && !form.purposeOther?.trim()) errors.purposeOther = 'Describe the purpose of your request.'
  if (!validDate(form.borrowDate)) errors.borrowDate = 'Choose a valid borrowing date.'
  else if (form.borrowDate < today) errors.borrowDate = 'Borrowing date cannot be in the past.'
  if (!validDate(form.returnDate)) errors.returnDate = 'Choose a valid return date.'
  else if (validDate(form.borrowDate) && form.returnDate < form.borrowDate) errors.returnDate = 'Return date must be on or after borrowing date.'
  if (!items.length) errors.items = 'Select at least one item.'
  const ids = new Set()
  for (const item of items) {
    const entered = String(item.quantity ?? '').trim()
    const quantity = Number(entered)
    const key = `item-${item.id}`
    if (ids.has(item.id)) errors.items = 'Each item may only appear once.'
    ids.add(item.id)
    if (!entered) errors[key] = 'Enter a quantity.'
    else if (!Number.isFinite(quantity)) errors[key] = 'Enter a valid number.'
    else if (quantity <= 0) errors[key] = 'Enter a quantity greater than zero.'
    else if (item.unit === 'pcs' && !Number.isSafeInteger(quantity)) errors[key] = 'Quantities in pcs must be whole numbers.'
    else if (!Number.isSafeInteger(Math.round(quantity * 100)) || Math.abs(quantity * 100 - Math.round(quantity * 100)) > 1e-6) errors[key] = 'Use at most 2 decimal places.'
    else if (quantity > item.available) errors[key] = `Only ${item.available} ${item.unit} currently available.`
    if (!item.unit) errors[key] = 'This item needs a unit before it can be requested.'
  }
  return errors
}

// After a failed submit, keep only the errors that still apply (with current messages); never add new ones while typing.
export function recheckErrors(current, form, items, today = localDate()) {
  const latest = validateBooking(form, items, today)
  return Object.fromEntries(Object.keys(current).filter((key) => current[key] && latest[key]).map((key) => [key, latest[key]]))
}

// Quantities are sent as integer hundredths (2 pcs = 200, 25.5 mL = 2550), matching request_items.
// The server takes the borrower from the session and must enforce units and availability.
// submissionKey stays the same across retries of one draft so the server never saves it twice.
export function bookingPayload(form, items, submissionKey) {
  return {
    submissionKey,
    subject: form.subject.trim(), purpose: form.purpose === 'Other' ? form.purposeOther.trim() : form.purpose,
    borrowDate: form.borrowDate, returnDate: form.returnDate,
    items: items.map(({ id, quantity }) => ({ inventoryId: id, quantity: Math.round(Number(quantity) * 100) })),
  }
}

// Draft items keep their quantity; name, unit and stock come from the current inventory.
// Items missing from it (inactive or removed) are dropped and returned separately.
export function refreshDraft(draft, inventory) {
  const current = new Map(inventory.map((item) => [item.id, item]))
  const items = []
  const removed = []
  for (const item of draft) {
    const live = current.get(item.id)
    if (live) items.push({ ...live, quantity: item.quantity })
    else removed.push(item)
  }
  return { items, removed }
}

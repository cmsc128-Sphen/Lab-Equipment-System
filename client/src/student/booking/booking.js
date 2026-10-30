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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (!form.studentId.trim()) errors.studentId = 'Enter your student ID.'
  if (!form.subject.trim()) errors.subject = 'Enter your subject.'
  if (!form.purpose.trim()) errors.purpose = 'Enter the purpose of your request.'
  if (!validDate(form.borrowDate)) errors.borrowDate = 'Choose a valid borrowing date.'
  else if (form.borrowDate < today) errors.borrowDate = 'Borrowing date cannot be in the past.'
  if (!validDate(form.returnDate)) errors.returnDate = 'Choose a valid return date.'
  else if (validDate(form.borrowDate) && form.returnDate < form.borrowDate) errors.returnDate = 'Return date must be on or after borrowing date.'
  if (!items.length) errors.items = 'Select at least one item.'
  const ids = new Set()
  for (const item of items) {
    const quantity = Number(item.quantity)
    const key = `item-${item.id}`
    if (ids.has(item.id)) errors.items = 'Each item may only appear once.'
    ids.add(item.id)
    if (!Number.isFinite(quantity) || quantity <= 0) errors[key] = 'Enter a quantity greater than zero.'
    else if (item.category !== 'chemical' && !Number.isSafeInteger(quantity)) errors[key] = 'Equipment quantities must be whole numbers.'
    else if (quantity > item.available) errors[key] = `Only ${item.available} ${item.unit} currently available.`
    if (!item.unit) errors[key] = 'This item needs a unit before it can be requested.'
  }
  return errors
}

// Proposed contract: the server must enforce identity, units and availability.
export function bookingPayload(form, items) {
  return {
    borrower: { email: form.email.trim(), studentId: form.studentId.trim() },
    subject: form.subject.trim(), purpose: form.purpose.trim(),
    borrowDate: form.borrowDate, returnDate: form.returnDate,
    items: items.map(({ id, quantity, unit }) => ({ inventoryId: id, quantity: Number(quantity), unit })),
  }
}

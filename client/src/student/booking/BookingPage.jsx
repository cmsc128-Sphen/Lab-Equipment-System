import { useEffect, useRef, useState } from 'react'
import { bookingPayload, localDate, recheckErrors, refreshDraft, validateBooking } from './booking.js'
import './BookingPage.css'

const PAGE_SIZE = 8
const blankForm = { studentId: '', subject: '', purpose: '', purposeOther: '', borrowDate: '', returnDate: '' }
const purposes = ['Laboratory experiment', 'Course requirement', 'Thesis', 'Research', 'Other']

/** Inventory: { id, name, category: 'equipment'|'chemical', unit, available, quantity? }.
 * submitRequest(payload) resolves to { reference, status: 'Pending' } after save.
 * onChooseItems is the inventory-navigation handoff; inventory enables a local picker.
 * onDraftChange(items) receives the draft after every change, and [] once a request is saved.
 * savedForm / onFormChange(form, submissionKey) keep the details and key across a sign-in; null once saved.
 * onStockChanged() reloads inventory after the server reports changed stock; onSignIn() starts a new sign-in.
 */
export default function BookingPage({ initialItems = [], inventory = [], inventoryNote = '', draftNote = '', borrower = {}, savedForm = null, submitRequest, onChooseItems, onDraftChange, onFormChange, onStockChanged, onSignIn, demo = false }) {
  const [form, setForm] = useState({ ...blankForm, ...savedForm?.form, studentId: borrower.studentId ?? '' })
  const [items, setItems] = useState(() => initialItems.map((item) => ({ ...item, quantity: String(item.quantity ?? 1) })))
  const [errors, setErrors] = useState({})
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState('')
  const [failureCode, setFailureCode] = useState('')
  const [stockCheck, setStockCheck] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const inFlight = useRef(false)
  // One key per draft: a retry after a lost response resolves to the request already saved.
  const submissionKey = useRef(savedForm?.submissionKey ?? crypto.randomUUID())
  const picker = useRef(null)
  const feedback = useRef(null)
  const locked = submitting || Boolean(confirmation)
  const [refreshedFrom, setRefreshedFrom] = useState(null)

  // Refresh stock, names and units from inventory once it loads; availability stays advisory until the server checks it.
  if (inventory.length && inventory !== refreshedFrom) {
    setRefreshedFrom(inventory)
    const { items: refreshed, removed } = refreshDraft(items, inventory)
    setItems(refreshed)
    const removedNote = removed.length ? `No longer available, removed from your request: ${removed.map((item) => item.name).join(', ')}. ` : ''
    if (stockCheck) {
      // After a changed-stock rejection, highlight exactly the items that no longer fit current stock.
      setStockCheck(false)
      const itemErrors = Object.fromEntries(Object.entries(validateBooking(form, refreshed)).filter(([key]) => key.startsWith('item-')))
      setErrors(itemErrors)
      setFailure(`${removedNote}${Object.keys(itemErrors).length ? 'Stock changed for the items below. Lower the quantities, then submit again.' : 'Stock was updated. Check your items, then submit again.'}`)
    } else if (removedNote) setFailure(removedNote.trim())
  }

  useEffect(() => {
    onDraftChange?.(confirmation ? [] : items)
  }, [items, confirmation, onDraftChange])

  useEffect(() => {
    onFormChange?.(confirmation ? null : form, submissionKey.current)
  }, [form, confirmation, onFormChange])

  function changeField(event) {
    const { name, value } = event.target
    const nextForm = { ...form, [name]: value }
    setForm(nextForm)
    setErrors((current) => recheckErrors(current, nextForm, items))
  }

  function changeItems(nextItems) {
    setItems(nextItems)
    setErrors((current) => recheckErrors(current, form, nextItems))
  }

  function addItem(item) {
    if (!items.some((entry) => entry.id === item.id)) changeItems([...items, { ...item, quantity: '1' }])
  }

  // Each summary entry moves focus to the control that needs fixing.
  function errorTarget(key) {
    if (key === 'items') return 'add-item'
    return key.startsWith('item-') ? `quantity-${key.slice(5)}` : key
  }

  async function chooseItems() {
    if (!onChooseItems) {
      setPage(0)
      setQuery('')
      picker.current.showModal()
      return
    }
    try {
      const selection = await onChooseItems(items.map((item) => ({ ...item })))
      if (Array.isArray(selection)) {
        setItems(selection.map((item) => ({ ...item, quantity: String(item.quantity ?? 1) })))
        setEditing(null)
        setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'items' && !key.startsWith('item-'))))
      }
    } catch {
      setFailure('Unable to load your item selection. Your form entries are still here.')
      requestAnimationFrame(() => feedback.current?.focus())
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (inFlight.current || confirmation) return
    const nextErrors = validateBooking(form, items)
    setErrors(nextErrors)
    setFailure('')
    setFailureCode('')
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => feedback.current?.focus())
      return
    }
    inFlight.current = true
    setSubmitting(true)
    try {
      if (!submitRequest) throw new Error('Booking submission is not connected yet. Your entries are still here.')
      const result = await submitRequest(bookingPayload(form, items, submissionKey.current))
      if (!result?.reference || typeof result.status !== 'string' || !result.status) throw new Error('The server did not confirm a saved request. Check with the lab before retrying.')
      setConfirmation(result)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to submit. Your entries are still here; please try again.')
      setFailureCode(error?.code ?? '')
      // The server's text for this case is written for developers; tell the student what happened instead.
      if (error?.code === 'BOOKING_SUBMISSION_CONFLICT') setFailure('This request was already saved before your latest changes. Your changes were not included.')
      if (['BOOKING_STOCK_EXCEEDED', 'BOOKING_ITEM_UNAVAILABLE'].includes(error?.code) && onStockChanged) {
        setFailure('Stock changed since you added these items. Updating current stock; if nothing changes, reload the page.')
        setStockCheck(true)
        onStockChanged()
      }
    } finally {
      inFlight.current = false
      setSubmitting(false)
      requestAnimationFrame(() => feedback.current?.focus())
    }
  }

  function field(name, label, type = 'text', extra = {}) {
    return <div className="booking-field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={form[name]} onChange={changeField} onInput={type === 'date' ? changeField : undefined} required disabled={locked} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} {...extra} />
      {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
    </div>
  }

  const search = query.trim().toLowerCase()
  const matches = search ? inventory.filter((item) => `${item.name} ${item.categoryName ?? item.category}`.toLowerCase().includes(search)) : inventory
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = matches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const itemCount = `${items.length} ${items.length === 1 ? 'item' : 'items'}`

  return <div className="booking-app">
    <main id="booking" className="booking-page">
      <div className="booking-heading">
        <h1>Book lab equipment</h1>
        <p>Enter your class details and choose the items you need. Lab staff review every request before pickup.</p>
      </div>
      {demo && <p className="demo-notice" role="note"><span aria-hidden="true">i</span>Booking preview with sample inventory. Demo submissions are not saved to the lab database.</p>}
      {draftNote && <p className="demo-notice" role="alert"><span aria-hidden="true">i</span>{draftNote}</p>}
      <form onSubmit={submit} noValidate aria-busy={submitting}>
        <div className="booking-workspace">
          <section className="booking-card borrower-fields" aria-labelledby="details-heading">
            <div className="card-heading"><h2 id="details-heading">Request details</h2></div>
            <div className="card-body">
              {field('studentId', 'Student ID', 'text', { autoComplete: 'off', readOnly: true })}
              {field('subject', 'Subject', 'text', { maxLength: 160, placeholder: 'e.g. Chem 16' })}
              <div className="booking-field">
                <label htmlFor="purpose">Purpose</label>
                <div className="purpose-input"><select id="purpose" name="purpose" value={form.purpose} onChange={changeField} required disabled={locked} className={form.purpose ? '' : 'is-placeholder'} aria-invalid={Boolean(errors.purpose)} aria-describedby={errors.purpose ? 'purpose-error' : undefined}>
                  <option value="" disabled>Choose a purpose</option>
                  {purposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
                </select>
                  <svg className="purpose-chevron" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
                </div>
                {errors.purpose && <span className="field-error" id="purpose-error">{errors.purpose}</span>}
              </div>
              {form.purpose === 'Other' && field('purposeOther', 'Specify purpose', 'text', { maxLength: 500, placeholder: 'e.g. Science fair project' })}
              <div className="booking-dates">
                {field('borrowDate', 'Borrowing date', 'date', { min: localDate() })}
                {field('returnDate', 'Return date', 'date', { min: form.borrowDate || localDate() })}
              </div>
            </div>
          </section>
          <section className="booking-card apparatus-section" aria-labelledby="apparatus-heading">
            <div className="card-heading">
              <h2 id="apparatus-heading">Requested items</h2>
              <span className="item-count">{itemCount}</span>
              <button type="button" id="add-item" className="add-item-button" disabled={locked} onClick={chooseItems}><span aria-hidden="true">+</span> Add item</button>
            </div>
            <div className="apparatus-list">
              <div className="apparatus-band" aria-hidden="true"><span>Item</span><span>Quantity</span><span /></div>
              {items.map((item) => <div className="apparatus-entry" key={item.id}>
                <div className="apparatus-row"><span className="item-name">{item.name}</span><span className="item-quantity">{item.quantity || '—'} {item.unit}</span><button className="edit-button" type="button" disabled={locked} aria-expanded={editing === item.id} aria-controls={`editor-${item.id}`} onClick={() => setEditing(editing === item.id ? null : item.id)}>{editing === item.id ? 'Done' : 'Edit'}<span className="booking-sr-only"> {item.name}</span></button></div>
                {(editing === item.id || errors[`item-${item.id}`]) && <div className="item-editor" id={`editor-${item.id}`}>
                  <label htmlFor={`quantity-${item.id}`}>Quantity ({item.unit})</label>
                  <input id={`quantity-${item.id}`} type="number" min="0" step={item.unit === 'pcs' ? '1' : '0.01'} value={item.quantity} disabled={locked} aria-invalid={Boolean(errors[`item-${item.id}`])} aria-describedby={`stock-${item.id}${errors[`item-${item.id}`] ? ` error-${item.id}` : ''}`} onChange={(event) => changeItems(items.map((entry) => entry.id === item.id ? { ...entry, quantity: event.target.value } : entry))} />
                  <small id={`stock-${item.id}`}>{item.available} {item.unit} in stock</small>
                  <button type="button" className="text-button danger" disabled={locked} onClick={() => changeItems(items.filter((entry) => entry.id !== item.id))}>Remove<span className="booking-sr-only"> {item.name}</span></button>
                  {errors[`item-${item.id}`] && <span className="field-error" id={`error-${item.id}`}>{errors[`item-${item.id}`]}</span>}
                </div>}
              </div>)}
              {!items.length && <div className="empty-items"><strong>No items yet</strong><span>Use “Add item” to choose equipment or chemicals.</span></div>}
            </div>
            <div className="booking-actions">
              <p className="availability-note">{submitRequest ? 'Stock is checked again when you submit.' : 'Select items and edit quantities. Request submission is not available yet.'}</p>
              <button type="submit" className="book-button" disabled={locked}>{submitting ? 'Submitting…' : confirmation ? 'Submitted' : 'Submit request'}</button>
            </div>
          </section>
        </div>
        {(Object.keys(errors).some((key) => errors[key]) || failure || confirmation) && <div className={`booking-feedback ${confirmation ? 'is-success' : ''}`} ref={feedback} tabIndex={-1} role={confirmation ? 'status' : 'alert'}>
          {confirmation ? <><h2>{demo ? 'Demo request complete' : 'Request saved'}</h2><p>Reference: <strong>{confirmation.reference}</strong> · Status: <strong>{confirmation.status}</strong></p><p>{demo ? 'This is a preview confirmation. No request was sent to the lab.' : (confirmation.status === 'Pending' ? 'Your request is awaiting staff review.' : 'Lab staff have already reviewed this request.')}</p><button type="button" className="text-button" onClick={() => { submissionKey.current = crypto.randomUUID(); setConfirmation(null); setItems([]); setForm((current) => ({ ...current, subject: '', purpose: '', purposeOther: '', borrowDate: '', returnDate: '' })); setEditing(null) }}>Create another request</button></> : <><strong>{failure || 'Please check the following:'}</strong>{failureCode === 'SESSION_EXPIRED' && onSignIn && <p><button type="button" className="text-button" onClick={onSignIn}>Sign in again</button></p>}{failureCode === 'BOOKING_SUBMISSION_CONFLICT' && <p><button type="button" className="text-button" onClick={(event) => { submissionKey.current = crypto.randomUUID(); onFormChange?.(form, submissionKey.current); event.currentTarget.form.requestSubmit() }}>Save my changes as a new request</button></p>}{Object.values(errors).some(Boolean) && <ul>{Object.entries(errors).filter(([, value]) => value).map(([key, value]) => <li key={key}><a href={`#${errorTarget(key)}`} onClick={(event) => { event.preventDefault(); document.getElementById(errorTarget(key))?.focus() }}>{key.startsWith('item-') ? `${items.find((item) => `item-${item.id}` === key)?.name}: ` : ''}{value}</a></li>)}</ul>}</>}
        </div>}
      </form>
    </main>
    <dialog ref={picker} className="item-picker" aria-labelledby="picker-title" onClick={(event) => { if (event.target === event.currentTarget) picker.current.close() }}>
      <div className="picker-heading"><div><h2 id="picker-title">Student inventory</h2><p>Add the items you need. You can change quantities after closing this list.</p></div><button className="text-button" type="button" onClick={() => picker.current.close()}>Close</button></div>
      {(inventoryNote || !inventory.length) && <p className="picker-note">{inventoryNote || 'Inventory is not connected yet.'}</p>}
      {inventory.length > 0 && <label className="picker-search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <span className="booking-sr-only">Search inventory</span>
        <input type="search" placeholder="Search inventory" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} />
      </label>}
      {inventory.length > 0 && <div className="picker-scroll"><table className="picker-table">
        <thead><tr><th scope="col">Item</th><th scope="col">Category</th><th scope="col">Available</th><th scope="col"><span className="booking-sr-only">Action</span></th></tr></thead>
        <tbody>{pageItems.map((item) => {
          const selected = items.some((entry) => entry.id === item.id)
          return <tr key={item.id}>
            <td className="picker-item-name">{item.name}</td>
            <td>{item.categoryName ?? item.category}</td>
            <td className={item.available > 0 ? '' : 'out-of-stock'}>{item.available > 0 ? `${item.available.toLocaleString()} ${item.unit}` : 'Out of stock'}</td>
            <td><button type="button" className={selected ? 'is-added' : ''} disabled={selected || item.available <= 0 || locked} onClick={() => addItem(item)}>{selected ? 'Added' : 'Add'}<span className="booking-sr-only"> {item.name}</span></button></td>
          </tr>
        })}
        {!matches.length && <tr><td className="picker-empty" colSpan="4">No items match “{query.trim()}”.</td></tr>}</tbody>
      </table></div>}
      <div className="picker-footer">
        {inventory.length > 0 && <nav className="paginator" aria-label="Inventory pages">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span aria-live="polite">Page {currentPage + 1} of {pageCount} · {matches.length} {matches.length === 1 ? 'item' : 'items'}</span>
          <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
        </nav>}
        <button type="button" className="book-button" onClick={() => picker.current.close()}>Done{items.length ? ` · ${itemCount}` : ''}</button>
      </div>
    </dialog>
  </div>
}

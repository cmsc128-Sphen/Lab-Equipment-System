import { useRef, useState } from 'react'
import { bookingPayload, localDate, validateBooking } from './booking.js'
import mark from '../assets/booking/department-mark.png'
import markBackground from '../assets/booking/mark-background.svg'
import chevronLeft from '../assets/booking/chevron-left.svg'
import chevronRight from '../assets/booking/chevron-right.svg'
import plusVertical from '../assets/booking/plus-vertical.svg'
import plusHorizontal from '../assets/booking/plus-horizontal.svg'
import './BookingPage.css'

const blankForm = { email: '', studentId: '', subject: '', purpose: '', borrowDate: '', returnDate: '' }

/** Inventory: { id, name, category: 'equipment'|'chemical', unit, available, quantity? }.
 * submitRequest(payload) resolves to { reference, status: 'Pending' } after save.
 * onChooseItems is the inventory-navigation handoff; inventory enables a local picker.
 */
export default function BookingPage({ initialItems = [], inventory = [], borrower = {}, submitRequest, onChooseItems, demo = false }) {
  const [form, setForm] = useState({ ...blankForm, email: borrower.email ?? '', studentId: borrower.studentId ?? '' })
  const [items, setItems] = useState(() => initialItems.map((item) => ({ ...item, quantity: String(item.quantity ?? 1) })))
  const [errors, setErrors] = useState({})
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const inFlight = useRef(false)
  const picker = useRef(null)
  const feedback = useRef(null)
  const locked = submitting || Boolean(confirmation)

  function changeField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function addItem(item) {
    setItems((current) => current.some((entry) => entry.id === item.id) ? current : [...current, { ...item, quantity: '1' }])
    setErrors((current) => ({ ...current, items: undefined }))
    picker.current.close()
  }

  async function submit(event) {
    event.preventDefault()
    if (inFlight.current || confirmation) return
    const nextErrors = validateBooking(form, items)
    setErrors(nextErrors)
    setFailure('')
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => feedback.current?.focus())
      return
    }
    inFlight.current = true
    setSubmitting(true)
    try {
      if (!submitRequest) throw new Error('Booking submission is not connected yet. Your entries are still here.')
      const result = await submitRequest(bookingPayload(form, items))
      if (!result?.reference || result.status !== 'Pending') throw new Error('The server did not confirm a saved Pending request. Check with the lab before retrying.')
      setConfirmation(result)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to submit. Your entries are still here; please try again.')
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

  return <div className="booking-app">
    <header className="booking-header">
      <div className="department-mark"><img className="mark-background" src={markBackground} alt="" /><img className="mark-image" src={mark} alt="Department of Chemistry, UP Visayas" /></div>
      <nav aria-label="Main navigation"><span>Lab Equipment System</span><a href="#booking" aria-current="page">Booking</a></nav>
    </header>
    <main id="booking" className="booking-panel">
      <h1 className="sr-only">Equipment and chemical booking</h1>
      {demo && <p className="demo-notice">Booking preview · Sample inventory. Demo submissions are not saved to the lab database.</p>}
      <form onSubmit={submit} noValidate aria-busy={submitting}>
        <div className="booking-columns">
          <section className="borrower-fields" aria-label="Borrower and schedule">
            {field('email', 'UP Mail', 'email', { autoComplete: 'email', readOnly: Boolean(borrower.email), maxLength: 254 })}
            {field('studentId', 'Student ID', 'text', { autoComplete: 'off', readOnly: Boolean(borrower.studentId), maxLength: 40 })}
            {field('subject', 'Subject', 'text', { maxLength: 160 })}
            <div className="booking-field purpose-field">
              <label htmlFor="purpose">Purpose</label>
              <div className="purpose-input"><input id="purpose" name="purpose" list="purpose-options" value={form.purpose} onChange={changeField} required disabled={locked} maxLength={500} aria-invalid={Boolean(errors.purpose)} aria-describedby={errors.purpose ? 'purpose-error' : undefined} />
                <span className="purpose-chevron" aria-hidden="true"><img src={chevronLeft} alt="" /><img src={chevronRight} alt="" /></span>
              </div>
              <datalist id="purpose-options"><option value="Laboratory experiment" /><option value="Course requirement" /><option value="Research" /></datalist>
              {errors.purpose && <span className="field-error" id="purpose-error">{errors.purpose}</span>}
            </div>
            <div className="booking-dates">
              {field('borrowDate', 'Borrowing date', 'date', { min: localDate() })}
              {field('returnDate', 'Return date', 'date', { min: form.borrowDate || localDate() })}
            </div>
          </section>
          <section className="apparatus-section" aria-labelledby="apparatus-heading">
            <h2 id="apparatus-heading">Apparatus</h2>
            <div className="apparatus-list">
              <div className="apparatus-band"><span>{items.length} selected {items.length === 1 ? 'item' : 'items'}</span><span>Quantity / unit</span></div>
              {items.map((item) => <div className="apparatus-entry" key={item.id}>
                <div className="apparatus-row"><span className="item-name">{item.name}</span><span className="item-quantity">Qty. {item.quantity || '—'} {item.unit}</span><button className="edit-button" type="button" disabled={locked} aria-expanded={editing === item.id} aria-controls={`editor-${item.id}`} onClick={() => setEditing(editing === item.id ? null : item.id)}>Edit<span className="sr-only"> {item.name}</span></button></div>
                {(editing === item.id || errors[`item-${item.id}`]) && <div className="item-editor" id={`editor-${item.id}`}>
                  <label htmlFor={`quantity-${item.id}`}>Quantity ({item.unit})</label>
                  <input id={`quantity-${item.id}`} type="number" min="0" step={item.category === 'chemical' ? 'any' : '1'} value={item.quantity} disabled={locked} aria-invalid={Boolean(errors[`item-${item.id}`])} aria-describedby={`stock-${item.id}${errors[`item-${item.id}`] ? ` error-${item.id}` : ''}`} onChange={(event) => { const value = event.target.value; setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: value } : entry)); setErrors((current) => ({ ...current, [`item-${item.id}`]: undefined })) }} />
                  <small id={`stock-${item.id}`}>Current stock: {item.available} {item.unit}</small>
                  <button type="button" className="text-button" disabled={locked} onClick={() => { setItems((current) => current.filter((entry) => entry.id !== item.id)); setErrors((current) => ({ ...current, [`item-${item.id}`]: undefined })) }}>Remove<span className="sr-only"> {item.name}</span></button>
                  {errors[`item-${item.id}`] && <span className="field-error" id={`error-${item.id}`}>{errors[`item-${item.id}`]}</span>}
                </div>}
              </div>)}
              {!items.length && <p className="empty-items">No items selected. Add apparatus or chemicals to begin.</p>}
              <button type="button" className="add-item-button" aria-label="Add apparatus or chemicals" disabled={locked} onClick={() => onChooseItems ? onChooseItems(items) : picker.current.showModal()}><span className="plus-icon" aria-hidden="true"><img src={plusVertical} alt="" /><img src={plusHorizontal} alt="" /></span></button>
            </div>
            <p className="availability-note">Availability is checked again on submission. Requests are subject to staff approval.</p>
            <div className="booking-actions"><button type="submit" className="book-button" disabled={locked}>{submitting ? 'Submitting…' : confirmation ? 'SUBMITTED' : 'BOOK'}</button></div>
          </section>
        </div>
        {(Object.keys(errors).some((key) => errors[key]) || failure || confirmation) && <div className={`booking-feedback ${confirmation ? 'is-success' : ''}`} ref={feedback} tabIndex={-1} role={confirmation ? 'status' : 'alert'}>
          {confirmation ? <><h2>{demo ? 'Demo request complete' : 'Request saved'}</h2><p>Reference: <strong>{confirmation.reference}</strong> · Status: <strong>{confirmation.status}</strong></p><p>{demo ? 'This is a preview confirmation. No request was sent to the lab.' : 'Your request is awaiting staff review.'}</p><button type="button" className="text-button" onClick={() => { setConfirmation(null); setItems([]); setForm((current) => ({ ...current, subject: '', purpose: '', borrowDate: '', returnDate: '' })); setEditing(null) }}>Create another request</button></> : <><strong>{failure || 'Please check the following:'}</strong>{!failure && <ul>{Object.entries(errors).filter(([, value]) => value).map(([key, value]) => <li key={key}>{key.startsWith('item-') ? `${items.find((item) => `item-${item.id}` === key)?.name}: ` : ''}{value}</li>)}</ul>}</>}
        </div>}
      </form>
    </main>
    <dialog ref={picker} className="item-picker" aria-labelledby="picker-title" onClick={(event) => { if (event.target === event.currentTarget) picker.current.close() }}>
      <div className="picker-heading"><h2 id="picker-title">Add apparatus or chemicals</h2><button className="text-button" type="button" onClick={() => picker.current.close()}>Close</button></div>
      {demo && <p>Sample inventory for the booking preview.</p>}
      {!inventory.length && <p>Inventory is not connected yet. Return to inventory to select items.</p>}
      <ul className="picker-list">{inventory.map((item) => <li key={item.id}><div><strong>{item.name}</strong><small>{item.available} {item.unit} available</small></div><button type="button" disabled={items.some((entry) => entry.id === item.id) || item.available <= 0} onClick={() => addItem(item)}>{items.some((entry) => entry.id === item.id) ? 'Selected' : 'Add'}</button></li>)}</ul>
    </dialog>
  </div>
}

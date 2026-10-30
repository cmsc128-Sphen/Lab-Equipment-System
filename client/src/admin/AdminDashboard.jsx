import { useMemo, useState } from 'react'
import { initialBookings } from './demoData.js'
import './admin.css'

const statusFilters = ['Approved', 'Ready for pickup', 'Disapproved']

function BookingStatus({ status }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`booking-status ${className}`}>{status}</span>
}

function EquipmentLogo() {
  return (
    <span aria-hidden="true" className="equipment-logo">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M7 5h18v22H7zM10 8h12v16H10z" />
        <path d="M12 11h8m-8 3h8m-8 3h5m-8-12V3m12 2V3" />
      </svg>
    </span>
  )
}

function AdminDashboard() {
  const [bookings, setBookings] = useState(initialBookings)
  const [selectedId, setSelectedId] = useState(initialBookings[0].id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [notice, setNotice] = useState('')
  const [showNotice, setShowNotice] = useState(false)

  const selectedBooking = bookings.find((booking) => booking.id === selectedId)
  const pendingCount = bookings.filter((booking) => booking.status === 'Pending').length
  const visibleBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return bookings.filter((booking) => {
      const matchesFilter = filter === 'All' || booking.status === filter
      const matchesQuery =
        !normalizedQuery ||
        [booking.studentName, booking.studentNumber, booking.id].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )

      return matchesFilter && matchesQuery
    })
  }, [bookings, filter, query])

  function updateSelectedBooking(updater) {
    setBookings((current) =>
      current.map((booking) => (booking.id === selectedId ? updater(booking) : booking)),
    )
    setNotice('')
  }

  function updateAllocation(itemIndex, rawValue) {
    const item = selectedBooking.items[itemIndex]
    const quantity = Math.min(
      item.requested,
      item.stock,
      Math.floor(Math.max(0, Number(rawValue) || 0)),
    )

    updateSelectedBooking((booking) => ({
      ...booking,
      items: booking.items.map((row, index) =>
        index === itemIndex ? { ...row, allocated: quantity } : row,
      ),
    }))
  }

  function approveBooking() {
    const anyAllocation = selectedBooking.items.some((item) => item.allocated > 0)
    if (!anyAllocation) {
      setNotice('Allocate at least one available item before approving this request.')
      return
    }

    updateSelectedBooking((booking) => ({ ...booking, status: 'Approved' }))
    setNotice(
      selectedBooking.emailDecision
        ? `Approval recorded for ${selectedBooking.id} in this prototype. Email is not sent.`
        : `Approval recorded for ${selectedBooking.id} in this prototype.`,
    )
  }

  function disapproveBooking() {
    if (!selectedBooking.denialReason.trim()) {
      setNotice('Enter a reason for disapproval before submitting your decision.')
      return
    }

    updateSelectedBooking((booking) => ({ ...booking, status: 'Disapproved' }))
    setNotice(
      selectedBooking.emailDecision
        ? `Disapproval recorded for ${selectedBooking.id} in this prototype. Email is not sent.`
        : `Disapproval recorded for ${selectedBooking.id} in this prototype.`,
    )
  }

  function selectBooking(booking) {
    setSelectedId(booking.id)
    setNotice('')
    setShowNotice(false)
  }

  return (
    <div className="equipment-app">
      <header className="site-header">
        <a aria-label="Equipment logger home" className="brand-lockup" href="#booking-review">
          <EquipmentLogo />
          <strong>Equipment logger</strong>
          <span className="admin-label">ADMIN</span>
        </a>

        <nav aria-label="Main navigation" className="main-nav">
          <a aria-current="page" className="active" href="#booking-review">Bookings</a>
          <span aria-disabled="true" className="disabled-link">Inventory</span>
          <span aria-disabled="true" className="disabled-link">Borrow history</span>
        </nav>

        <button
          aria-expanded={showNotice}
          aria-label="Lab staff profile"
          className="staff-profile"
          onClick={() => setShowNotice((visible) => !visible)}
          type="button"
        >
          <span className="profile-initials">LC</span>
          <span className="profile-text"><strong>L. Cruz</strong><small>Laboratory staff</small></span>
          <span aria-hidden="true" className="profile-chevron">⌄</span>
        </button>
      </header>

      <main className="booking-page" id="booking-review">
        <section className="page-title-row">
          <div>
            <h1>Booking review</h1>
            <p>Review student request slips, check stock, and communicate your decision.</p>
          </div>
          <div className="department-info">
            <strong>Chemistry department · Main laboratory</strong>
            <span>Thursday, 15 October 2026 · Illustrative request data</span>
          </div>
        </section>

        <div className="prototype-notice" role="note">
          <span aria-hidden="true">i</span>
          Prototype only — booking changes and email choices are temporary screen state and reset on refresh; no server or Firebase is connected.
        </div>

        <section aria-label="Booking review workspace" className="booking-workspace">
          <aside aria-label="Student bookings" className="booking-list-panel">
            <div className="list-panel-heading">
              <h2>Student bookings</h2>
              <span>{visibleBookings.length} requests</span>
            </div>

            <label className="search-field">
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" />
              </svg>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, student no., or request ID"
                type="search"
                value={query}
              />
            </label>

            <div aria-label="Filter bookings" className="filter-tabs">
              {['All', 'Pending'].map((option) => (
                <button
                  aria-pressed={filter === option}
                  className={filter === option ? 'filter-chip active' : 'filter-chip'}
                  key={option}
                  onClick={() => setFilter(option)}
                  type="button"
                >
                  {option === 'All' ? `All · ${bookings.length}` : `Pending · ${pendingCount}`}
                </button>
              ))}
              <label className="status-filter">
                <span className="visually-hidden">Filter by status</span>
                <select
                  aria-label="Filter by status"
                  onChange={(event) => setFilter(event.target.value)}
                  value={statusFilters.includes(filter) ? filter : ''}
                >
                  <option value="">Status</option>
                  {statusFilters.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>

            <div className="booking-rows">
              {visibleBookings.map((booking) => (
                <button
                  aria-current={selectedId === booking.id ? 'true' : undefined}
                  className={`booking-row ${selectedId === booking.id ? 'selected' : ''}`}
                  key={booking.id}
                  onClick={() => selectBooking(booking)}
                  type="button"
                >
                  <span className="booking-row-top">
                    <strong>{booking.studentName}</strong>
                    <BookingStatus status={booking.status} />
                  </span>
                  <span className="booking-row-meta">{booking.id} · {booking.items.length} line items</span>
                  <span className="booking-row-pickup">Pickup: {booking.pickupLabel}</span>
                  {selectedId === booking.id && <span className="selected-indicator">Selected →</span>}
                </button>
              ))}
              {visibleBookings.length === 0 && (
                <div className="no-bookings">No bookings match this search.</div>
              )}
            </div>

            <div className="list-pagination">
              <span>Showing {visibleBookings.length ? 1 : 0}–{visibleBookings.length} of {visibleBookings.length}</span>
              <div><button aria-label="Previous page" disabled type="button">‹</button><span>1</span><button aria-label="Next page" disabled type="button">›</button></div>
            </div>
          </aside>

          {selectedBooking ? (
            <section aria-label="Selected booking details" className="review-panel">
              <div className="request-heading">
                <div>
                  <h2>Request {selectedBooking.id}</h2>
                  <p>{selectedBooking.studentName} · Digital borrowing request slip</p>
                </div>
                <div className="review-state">
                  <span>{selectedBooking.status === 'Pending' ? 'Awaiting staff decision' : `Staff decision recorded`}</span>
                  <BookingStatus status={selectedBooking.status} />
                </div>
              </div>

              <div className="student-details">
                <div><span>Student name</span><strong>{selectedBooking.studentName}</strong></div>
                <div><span>Student number</span><strong>{selectedBooking.studentNumber}</strong></div>
                <div><span>Email address</span><strong>{selectedBooking.email}</strong></div>
                <div><span>Requester category</span><strong>{selectedBooking.category}</strong></div>
                <div><span>Submitted</span><strong>{selectedBooking.submittedAt}</strong></div>
                <div><span>Pickup / borrow date</span><strong>{selectedBooking.pickupAt}</strong></div>
                <div><span>Expected return</span><strong>{selectedBooking.returnAt}</strong></div>
                <div><span>Purpose / course</span><strong>{selectedBooking.purpose}</strong></div>
              </div>

              <div className="policy-note">
                <span aria-hidden="true">ⓘ</span>
                Advance notice met (at least 1 day). Undergraduate equipment must be returned by end of day; chemicals and disposables are not returnable.
              </div>

              <div className="equipment-section">
                <div className="equipment-section-heading">
                  <h3>Requested equipment &amp; materials</h3>
                  <span>{selectedBooking.items.length} line items · Stock checked 15 Oct, 10:20 AM</span>
                </div>
                <div className="equipment-table-wrap">
                  <table className="equipment-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Requested qty.</th>
                        <th>Stock on hand</th>
                        <th>Approve / allocate qty.</th>
                        <th>Availability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBooking.items.map((item, index) => {
                        const outOfStock = item.stock === 0
                        const rationed = item.allocated < item.requested && !outOfStock
                        const editable = selectedBooking.status === 'Pending'

                        return (
                          <tr className={outOfStock ? 'out-of-stock-row' : ''} key={`${item.name}-${index}`}>
                            <td><strong>{item.name}</strong></td>
                            <td>{item.category}</td>
                            <td>{item.requested} {item.unit}</td>
                            <td><strong className={outOfStock ? 'zero-stock' : ''}>{item.stock.toLocaleString()} {item.unit}</strong></td>
                            <td>
                              <label className="allocation-cell">
                                <span className="visually-hidden">{`Approve quantity of ${item.name}`}</span>
                                <input
                                  aria-label={`Approve quantity of ${item.name}`}
                                  disabled={!editable}
                                  max={Math.min(item.stock, item.requested)}
                                  min="0"
                                  onChange={(event) => updateAllocation(index, event.target.value)}
                                  type="number"
                                  value={item.allocated}
                                />
                                <span>{item.unit}</span>
                              </label>
                            </td>
                            <td>
                              {outOfStock ? (
                                <span className="availability unavailable"><span aria-hidden="true">ⓘ</span> Out of stock</span>
                              ) : rationed ? (
                                <span className="availability rationed"><span aria-hidden="true">ⓘ</span> Rationed · {item.allocated} {item.unit}</span>
                              ) : (
                                <span className="availability available"><span aria-hidden="true">✓</span> Available</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="allocation-footnote">
                  <span aria-hidden="true">ⓘ</span>
                  Unavailable items cannot be allocated. Approval covers allocated quantities only.
                </p>
              </div>

              <div className="decision-fields">
                <label>
                  <span>Staff remarks / allocation notes</span>
                  <textarea
                    disabled={selectedBooking.status !== 'Pending'}
                    onChange={(event) => updateSelectedBooking((booking) => ({ ...booking, staffNotes: event.target.value }))}
                    placeholder="Add notes about substitutions, partial quantities, or preparation..."
                    rows="2"
                    value={selectedBooking.staffNotes}
                  />
                  <small>Intended for the approval email when email integration is implemented.</small>
                </label>
                <label>
                  <span>Reason for disapproval</span>
                  <textarea
                    disabled={selectedBooking.status !== 'Pending'}
                    onChange={(event) => updateSelectedBooking((booking) => ({ ...booking, denialReason: event.target.value }))}
                    placeholder="Enter a reason if disapproving this request..."
                    rows="2"
                    value={selectedBooking.denialReason}
                  />
                  <small>Required for disapproval; intended for the email notification.</small>
                </label>
              </div>

              <label className="email-option">
                <input
                  checked={selectedBooking.emailDecision}
                  disabled={selectedBooking.status !== 'Pending'}
                  onChange={(event) => updateSelectedBooking((booking) => ({ ...booking, emailDecision: event.target.checked }))}
                  type="checkbox"
                />
                <span>Email decision to {selectedBooking.email}</span>
                <small>Prototype only</small>
              </label>

              {notice && <p className="decision-notice" role="status">{notice}</p>}

              <footer className="review-footer">
                <div className="next-step">
                  <span>Next step · available after approval and preparation</span>
                  <div>
                    <button className="prepare-button" disabled type="button"><span aria-hidden="true">⬡</span> Mark ready for pickup</button>
                    <small>Sends a separate pickup email</small>
                  </div>
                </div>
                <div className="decision-actions">
                  <span>{selectedBooking.status === 'Pending' ? 'Approve with the allocations shown above' : 'This request has already been reviewed'}</span>
                  <div>
                    <button
                      className="disapprove-button"
                      disabled={selectedBooking.status !== 'Pending'}
                      onClick={disapproveBooking}
                      type="button"
                    >
                      <span aria-hidden="true">×</span> Disapprove request
                    </button>
                    <button
                      className="approve-button"
                      disabled={selectedBooking.status !== 'Pending'}
                      onClick={approveBooking}
                      type="button"
                    >
                      <span aria-hidden="true">✓</span> Approve request
                    </button>
                  </div>
                </div>
              </footer>
            </section>
          ) : (
            <section className="review-panel no-selection">
              <h2>No booking selected</h2>
              <p>Choose a request from the list to review its details.</p>
            </section>
          )}
        </section>
      </main>

      {showNotice && (
        <div className="prototype-popover" role="status">
          Signed in as laboratory staff. Authentication is not connected in this prototype.
          <button aria-label="Close notice" onClick={() => setShowNotice(false)} type="button">×</button>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard

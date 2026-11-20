import { useEffect, useMemo, useState } from 'react'

import { getIdToken } from '../auth/getIdToken.js'

import { bookingStatuses, createAdminBookingClient } from '../services/adminBookings.js'

import './admin.css'

const statusFilters = Object.values(bookingStatuses).filter((status) => status !== 'Pending')

const bookingClient = createAdminBookingClient({ getAccessToken: getIdToken })

function BookingStatus({ status }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`booking-status ${className}`}>{status}</span>
}

function AdminDashboard() {
  const [bookings, setBookings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [notice, setNotice] = useState('')

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [loadError, setLoadError] = useState('')

  const [needsRefresh, setNeedsRefresh] = useState(false)

  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    bookingClient.load({ signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return

        setBookings(rows)

        setSelectedId((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? null))

        setNeedsRefresh(false)

        setLoading(false)
      })
      .catch((error) => {
        if (controller.signal.aborted) return

        setBookings([])

        setLoadError(error.message)

        setLoading(false)
      })

    return () => controller.abort()
  }, [refreshVersion])

  function refreshBookings() {
    setLoading(true)

    setLoadError('')

    setRefreshVersion((version) => version + 1)
  }

  const selectedBooking = bookings.find((booking) => booking.id === selectedId)
  const pendingCount = bookings.filter((booking) => booking.status === 'Pending').length
  const visibleBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return bookings.filter((booking) => {
      const matchesFilter = filter === 'All' || booking.status === filter
      const matchesQuery =
        !normalizedQuery ||
        [booking.studentName, booking.studentNumber, booking.requestNumber].some((value) =>
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
      Math.round(Math.max(0, Number(rawValue) || 0) * (item.unit === 'pcs' ? 1 : 100)) / (item.unit === 'pcs' ? 1 : 100),
    )

    updateSelectedBooking((booking) => ({
      ...booking,
      items: booking.items.map((row, index) =>
        index === itemIndex ? { ...row, allocated: quantity } : row,
      ),
    }))
  }

  async function saveDecision(action) {
    if (saving || loading || needsRefresh || !selectedBooking) return

    if (action === 'approved' && !selectedBooking.items.some((item) => item.allocated > 0)) {
      setNotice('Allocate at least one available item before approving this request.')

      return
    }

    if (action === 'denied' && !selectedBooking.denialReason.trim()) {
      setNotice('Enter a reason for disapproval before submitting your decision.')

      return
    }

    setSaving(true)

    setNotice('')

    try {
      await bookingClient.decide(selectedBooking, action)

      setNotice(`${selectedBooking.requestNumber}: ${bookingStatuses[action]}. Saved to the database. Email was not sent.`)

      refreshBookings()
    } catch (error) {
      setNotice(error.message)

      setNeedsRefresh(true)
    } finally {
      setSaving(false)
    }
  }

  function selectBooking(booking) {
    setSelectedId(booking.id)
    setNotice('')
  }

  return (
    <div className="equipment-app">
      <main className="booking-page" id="booking-review">
        <section className="page-title-row">
          <div>
            <h1>Booking review</h1>
            <p>Review student request slips, check stock, and communicate your decision.</p>
          </div>
          <button className="prepare-button" disabled={loading || saving} onClick={refreshBookings} type="button">
            {loading ? 'Loading...' : 'Refresh bookings'}
          </button>
        </section>

        {loadError && <p className="decision-notice" role="alert">{loadError}</p>}
        {notice && <p className="decision-notice" role="status">{notice}</p>}
        {saving && <p className="decision-notice" role="status">Saving decision...</p>}
        {needsRefresh && <p role="alert">Refresh bookings before submitting another decision.</p>}

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
                  disabled={saving || loading}
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
                <div className="no-bookings">{loading ? 'Loading bookings...' : loadError ? 'Bookings could not be loaded.' : bookings.length ? 'No bookings match this search.' : 'No bookings have been submitted yet.'}</div>
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
                  <h2>Request {selectedBooking.requestNumber}</h2>
                  <p>{selectedBooking.studentName} · Digital borrowing request slip</p>
                </div>
                <div className="review-state">
                  <span>{selectedBooking.status === 'Pending' ? 'Awaiting staff decision' : 'Saved request status'}</span>
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
                Check the requested dates and return policy before approving. Stock is reserved when approval is saved.
              </div>

              <div className="equipment-section">
                <div className="equipment-section-heading">
                  <h3>Requested equipment &amp; materials</h3>
                  <span>{selectedBooking.items.length} line items · Current available stock</span>
                </div>
                <div className="equipment-table-wrap">
                  <table className="equipment-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Requested qty.</th>
                        <th>Available stock</th>
                        <th>Approve / allocate qty.</th>
                        <th>Availability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBooking.items.map((item, index) => {
                        const outOfStock = item.stock === 0
                        const rationed = item.allocated < item.requested && !outOfStock
                        const editable = selectedBooking.status === 'Pending' && !saving && !loading && !needsRefresh

                        return (
                          <tr className={outOfStock && selectedBooking.status === 'Pending' ? 'out-of-stock-row' : ''} key={item.id}>
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
                                  step={item.unit === 'pcs' ? 1 : 0.01}
                                  min="0"
                                  onChange={(event) => updateAllocation(index, event.target.value)}
                                  type="number"
                                  value={item.allocated}
                                />
                                <span>{item.unit}</span>
                              </label>
                            </td>
                            <td>
                              {selectedBooking.status !== 'Pending' ? (
                                <span className={`availability ${item.allocated > 0 ? 'available' : 'unavailable'}`}>
                                  {item.allocated > 0 ? `Approved: ${item.allocated} ${item.unit}` : 'Not allocated'}
                                </span>
                              ) : outOfStock ? (
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
                    disabled={selectedBooking.status !== 'Pending' || saving || loading || needsRefresh}
                    onChange={(event) => updateSelectedBooking((booking) => ({ ...booking, staffNotes: event.target.value }))}
                    placeholder="Add notes about substitutions, partial quantities, or preparation..."
                    rows="2"
                    maxLength={2000}
                    value={selectedBooking.staffNotes}
                  />
                  <small>Saved with the staff decision.</small>
                </label>
                <label>
                  <span>Reason for disapproval</span>
                  <textarea
                    disabled={selectedBooking.status !== 'Pending' || saving || loading || needsRefresh}
                    onChange={(event) => updateSelectedBooking((booking) => ({ ...booking, denialReason: event.target.value }))}
                    placeholder="Enter a reason if disapproving this request..."
                    rows="2"
                    maxLength={2000}
                    value={selectedBooking.denialReason}
                  />
                  <small>Required and saved when disapproving the request.</small>
                </label>
              </div>

              <p className="allocation-footnote">Decisions are saved in the database. Email notifications are not connected yet.</p>

              <footer className="review-footer">
                <div className="next-step">
                  <span>Next step · available after approval and preparation</span>
                  <div>
                    <button className="prepare-button" disabled={selectedBooking.status !== 'Approved' || saving || loading || needsRefresh} onClick={() => saveDecision('ready')} type="button"><span aria-hidden="true">⬡</span> Mark ready for pickup</button>
                    <small>Saves pickup readiness; no email is sent</small>
                  </div>
                </div>
                <div className="decision-actions">
                  <span>{selectedBooking.status === 'Pending' ? 'Approve with the allocations shown above' : 'This request has already been reviewed'}</span>
                  <div>
                    <button
                      className="disapprove-button"
                      disabled={selectedBooking.status !== 'Pending' || saving || loading || needsRefresh}
                      onClick={() => saveDecision('denied')}
                      type="button"
                    >
                      <span aria-hidden="true">×</span> Disapprove request
                    </button>
                    <button
                      className="approve-button"
                      disabled={selectedBooking.status !== 'Pending' || saving || loading || needsRefresh}
                      onClick={() => saveDecision('approved')}
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
              <p>{loading ? 'Loading bookings...' : 'Choose a request from the list to review its details.'}</p>
            </section>
          )}
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard

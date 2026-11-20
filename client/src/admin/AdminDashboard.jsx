import { useEffect, useMemo, useState } from 'react'

import { getIdToken } from '../auth/getIdToken.js'

import { createAdminBookingClient } from '../services/adminBookings.js'

import './admin.css'

const bookingClient = createAdminBookingClient({ getAccessToken: getIdToken })

function BookingStatus({ status }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`booking-status ${className}`}>{status}</span>
}

function AdminDashboard() {
  const [bookings, setBookings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')

  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState('')

  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    bookingClient.load({ signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return

        setBookings(rows)

        setSelectedId((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? null))

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

    setBookings([])
    setSelectedId(null)

    setRefreshVersion((version) => version + 1)
  }

  const selectedBooking = bookings.find((booking) => booking.id === selectedId)
  const visibleBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return bookings.filter((booking) => {
      const matchesQuery =
        !normalizedQuery ||
        [booking.studentName, booking.studentNumber, booking.requestNumber].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )

      return matchesQuery
    })
  }, [bookings, query])

  function selectBooking(booking) {
    setSelectedId(booking.id)
    setNotice('')
  }

  return (
    <div className="equipment-app">
      <main className="booking-page" id="booking-review">
        <section className="page-title-row">
          <div>
            <h1>Pending booking requests</h1>
            <p>Review saved student requests and their requested items.</p>
          </div>
          <button className="prepare-button" disabled={loading} onClick={refreshBookings} type="button">
            {loading ? 'Loading...' : 'Refresh bookings'}
          </button>
        </section>

        {loadError && <p className="decision-notice" role="alert">{loadError}</p>}

        <section aria-label="Booking review workspace" className="booking-workspace">
          <aside aria-label="Student bookings" className="booking-list-panel">
            <div className="list-panel-heading">
              <h2>Pending requests</h2>
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

            <div className="booking-rows">
              {visibleBookings.map((booking) => (
                <button
                  aria-current={selectedId === booking.id ? 'true' : undefined}
                  className={`booking-row ${selectedId === booking.id ? 'selected' : ''}`}
                  disabled={loading}
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
              {loading && <div className="no-bookings" role="status">Loading Pending requests…</div>}
              {!loading && loadError && <div className="no-bookings">Pending requests could not be loaded.</div>}
              {!loading && !loadError && bookings.length === 0 && <div className="no-bookings">No Pending requests.</div>}
              {!loading && !loadError && bookings.length > 0 && visibleBookings.length === 0 && <div className="no-bookings">No Pending requests match this search.</div>}
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
                  <p>{selectedBooking.studentName} · Saved borrowing request</p>
                </div>
                <div className="review-state">
                  <span>Awaiting staff decision</span>
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
                Review-only queue. Approval, disapproval, allocations, pickup readiness, and email are deferred.
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
                        <th>Stock check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBooking.items.map((item) => {
                        const outOfStock = item.stock === 0
                        const insufficientStock = item.stock < item.requested

                        return (
                          <tr className={outOfStock ? 'out-of-stock-row' : ''} key={item.id}>
                            <td><strong>{item.name}</strong></td>
                            <td>{item.category}</td>
                            <td>{item.requested} {item.unit}</td>
                            <td><strong className={outOfStock ? 'zero-stock' : ''}>{item.stock.toLocaleString()} {item.unit}</strong></td>
                            <td>
                              {outOfStock ? (
                                <span className="availability unavailable"><span aria-hidden="true">ⓘ</span> Out of stock</span>
                              ) : insufficientStock ? (
                                <span className="availability rationed">Insufficient for requested quantity</span>
                              ) : (
                                <span className="availability available">Available for requested quantity</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

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

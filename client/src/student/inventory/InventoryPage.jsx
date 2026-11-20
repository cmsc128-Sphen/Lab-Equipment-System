import { useEffect, useMemo, useState } from 'react'
import { getItems } from '../../data/items.js'
import { filterInventoryItems } from './inventoryFilters.js'
import './InventoryPage.css'

function InventoryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [availability, setAvailability] = useState('All')
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let active = true

    const controller = new AbortController()

    getItems({ signal: controller.signal })
      .then(({ items: inventoryItems }) => {
        if (active) {
          setItems(inventoryItems)
          setLoading(false)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message)
          setLoading(false)
        }
      })

    return () => {
      active = false

      controller.abort()
    }
  }, [])

  const categories = [...new Set(items.map((item) => item.categoryName))].sort((left, right) =>
    left.localeCompare(right),
  )
  const visibleItems = useMemo(() => {
    return filterInventoryItems(items, {
      query,
      category: selectedCategory,
      availability,
    })
  }, [items, query, selectedCategory, availability])
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedItems = visibleItems.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage,
  )
  const rangeStart = visibleItems.length ? (safeCurrentPage - 1) * itemsPerPage + 1 : 0
  const rangeEnd = Math.min(safeCurrentPage * itemsPerPage, visibleItems.length)

  return (
    <div className="app-shell">
      <div className="workspace">
        <aside className="sidebar" aria-label="Inventory navigation">
          <div className="sidebar-heading">CATALOGUE</div>
          <button
            aria-pressed={selectedCategory === 'All'}
            className={`sidebar-link ${selectedCategory === 'All' ? 'selected' : ''}`}
            onClick={() => {
              setSelectedCategory('All')
              setCurrentPage(1)
            }}
            type="button"
          >
            <span className="sidebar-icon" aria-hidden="true">▦</span>
            All inventory
            <span className="sidebar-count">{visibleItems.length}</span>
          </button>
          <div className="sidebar-heading category-heading">CATEGORIES</div>
          <ul className="category-list">
            {categories.map((category) => (
              <li key={category}>
                <button
                  aria-pressed={selectedCategory === category}
                  className={`category-filter-button ${selectedCategory === category ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedCategory(category)
                    setCurrentPage(1)
                  }}
                  type="button"
                >
                  <span className="category-dot" aria-hidden="true" />
                  <span>{category}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content" id="inventory">
          <div className="page-heading">
            <div>
              <p className="eyebrow">LAB OPERATIONS</p>
              <h1>Inventory</h1>
              <p className="page-description">
                Browse and check the availability of laboratory supplies.
              </p>
            </div>
            <div className="inventory-summary">
              <span className="summary-number">{visibleItems.length}</span>
              <span className="summary-label">catalogue items</span>
            </div>
          </div>

          <section className="catalogue-panel" aria-label="Inventory catalogue">
            <div className="catalogue-toolbar">
              <div>
                <h2>All inventory</h2>
                <p className="toolbar-description">
                  Browse available equipment, chemicals, and supplies.
                </p>
              </div>
              <label className="search-field">
                <svg viewBox="0 0 20 20" aria-hidden="true" className="search-icon">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="m13 13 4 4" />
                </svg>
                <input
                  type="search"
                  placeholder="Search inventory"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setCurrentPage(1)
                  }}
                  value={query}
                />
                <span className="search-shortcut" aria-hidden="true">⌕</span>
              </label>
            </div>

            <div className="inventory-list-controls">
              <label className="availability-filter">
                <span>Availability</span>
                <select
                  aria-label="Filter by availability"
                  onChange={(event) => {
                    setAvailability(event.target.value)
                    setCurrentPage(1)
                  }}
                  value={availability}
                >
                  <option value="All">All</option>
                  <option value="in-stock">In stock</option>
                  <option value="out-of-stock">Out of stock</option>
                </select>
              </label>
              <label className="items-per-page">
                <span>Items per page</span>
                <select
                  aria-label="Items per page"
                  onChange={(event) => {
                    setItemsPerPage(Number(event.target.value))
                    setCurrentPage(1)
                  }}
                  value={itemsPerPage}
                >
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
            </div>

            <div className="table-scroll">
              <table className="inventory-table">
                <colgroup>
                  <col className="item-column" />
                  <col className="category-column" />
                  <col className="type-column" />
                  <col className="stock-column" />
                  <col className="status-column" />
                  <col className="action-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">ITEM</th>
                    <th scope="col">CATEGORY</th>
                    <th scope="col">TYPE</th>
                    <th scope="col">AVAILABLE STOCK</th>
                    <th scope="col">STATUS</th>
                    <th scope="col">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td className="table-message" colSpan="6">Loading inventory…</td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td className="table-message error-message" colSpan="6">{error}</td>
                    </tr>
                  )}
                  {!loading && !error && visibleItems.length === 0 && (
                    <tr>
                      <td className="table-message" colSpan="6">
                        {items.length === 0
                          ? 'No inventory items found.'
                          : 'No inventory items match your search and filters.'}
                      </td>
                    </tr>
                  )}
                  {!loading && !error && pagedItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="item-cell">
                          <span className={`item-icon ${item.type}`} aria-hidden="true">
                            {item.type === 'chemical' ? '◈' : item.type === 'disposable' ? '◇' : '▧'}
                          </span>
                          <div>
                            <span className="item-name">{item.name}</span>
                            <span className="item-code">{item.code}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="category-pill">{item.categoryName}</span></td>
                      <td className="type-cell">{item.type}</td>
                      <td>
                        <span className="stock-value">
                          {(item.stock.available / item.quantityScale).toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${item.stock.available > 0 ? 'in-stock' : 'out-of-stock'}`}>
                          <span className="status-indicator" aria-hidden="true" />
                          {item.stock.available > 0 ? 'In stock' : 'Out of stock'}
                        </span>
                      </td>
                      <td>
                        <button
                          aria-label={`Add ${item.name} to booking`}
                          className="add-to-booking-button"
                          disabled
                          title="Add to booking (coming soon)"
                          type="button"
                        >
                          <span aria-hidden="true">+</span>
                          Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="table-footer">
              <span>
                Showing <strong>{loading || error ? 0 : rangeStart}–{loading || error ? 0 : rangeEnd}</strong> of <strong>{loading || error ? 0 : visibleItems.length}</strong> items
              </span>
              <div className="inventory-pagination" aria-label="Inventory pagination">
                <button
                  aria-label="Previous page"
                  disabled={loading || Boolean(error) || safeCurrentPage === 1}
                  onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  type="button"
                >
                  ‹
                </button>
                <span>Page {safeCurrentPage} of {totalPages}</span>
                <button
                  aria-label="Next page"
                  disabled={loading || Boolean(error) || safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  type="button"
                >
                  ›
                </button>
              </div>
            </footer>
            <p className="table-footer-note">
              Stock quantities reflect currently available units.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

export default InventoryPage

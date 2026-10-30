import { useEffect, useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import { getItems } from './data/items.js'
import './App.css'

function Navigation({ view, onChange }) {
  return (
    <header className="topbar">
      <a className="brand" href="#home" onClick={() => onChange('home')}>
        <span className="brand-mark" aria-hidden="true">L</span>
        <span>Lab Equipment System</span>
      </a>
      <nav className="top-nav" aria-label="Main navigation">
        <button
          className={`top-nav-link ${view === 'home' ? 'active' : ''}`}
          onClick={() => onChange('home')}
          type="button"
        >
          Home
        </button>
        <button
          className={`top-nav-link ${view === 'inventory' ? 'active' : ''}`}
          onClick={() => onChange('inventory')}
          type="button"
        >
          Inventory
        </button>
      </nav>
      <div className="profile" aria-label="Account">
        <span className="profile-avatar" aria-hidden="true">U</span>
        <span className="profile-label">User</span>
      </div>
    </header>
  )
}

function HomePage() {
  const [count, setCount] = useState(0)

  return (
    <div className="home-page">
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((currentCount) => currentCount + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks" />

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank" rel="noreferrer">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank" rel="noreferrer">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks" />
      <section id="spacer" />
    </div>
  )
}

function InventoryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getItems()
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
    }
  }, [])

  const categories = [...new Set(items.map((item) => item.categoryName))]

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="Inventory navigation">
        <div className="sidebar-heading">CATALOGUE</div>
        <div className="sidebar-link selected">
          <span className="sidebar-icon" aria-hidden="true">▦</span>
          All inventory
          <span className="sidebar-count">{items.length}</span>
        </div>
        <div className="sidebar-heading category-heading">CATEGORIES</div>
        <ul className="category-list">
          {categories.map((category) => (
            <li key={category}>
              <span className="category-dot" aria-hidden="true" />
              <span>{category}</span>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          Inventory system
        </div>
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
            <span className="summary-number">{items.length}</span>
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
              <input type="search" placeholder="Search inventory" />
              <span className="search-shortcut" aria-hidden="true">⌕</span>
            </label>
          </div>

          <div className="table-scroll">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th scope="col">ITEM</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">TYPE</th>
                  <th scope="col">AVAILABLE STOCK</th>
                  <th scope="col">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="table-message" colSpan="5">Loading inventory…</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td className="table-message error-message" colSpan="5">{error}</td>
                  </tr>
                )}
                {!loading && !error && items.length === 0 && (
                  <tr>
                    <td className="table-message" colSpan="5">No inventory items found.</td>
                  </tr>
                )}
                {!loading && !error && items.map((item) => (
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
                        {item.stock.available.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${item.stock.available > 0 ? 'in-stock' : 'out-of-stock'}`}>
                        <span className="status-indicator" aria-hidden="true" />
                        {item.stock.available > 0 ? 'In stock' : 'Out of stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="table-footer">
            <span>
              Showing <strong>{loading || error ? 0 : items.length}</strong> items
            </span>
            <span className="table-footer-note">
              Stock quantities reflect currently available units.
            </span>
          </footer>
        </section>
      </main>
    </div>
  )
}

function App() {
  const [view, setView] = useState('home')

  return (
    <div className="app-shell">
      <Navigation view={view} onChange={setView} />
      {view === 'inventory' ? <InventoryPage /> : <HomePage />}
    </div>
  )
}

export default App

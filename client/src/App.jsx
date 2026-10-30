import InventoryPage from './student/InventoryPage.jsx'
import './App.css'

function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/inventory') {
    return <InventoryPage />
  }

  return null
}

export default App

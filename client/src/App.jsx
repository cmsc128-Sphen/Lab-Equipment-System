import AdminDashboard from './admin/AdminDashboard.jsx'
import InventoryPage from './student/InventoryPage.jsx'

function App() {
    const pathname = window.location.pathname.replace(/\/+$/, '')
    return pathname === '/inventory/admin' ? <AdminDashboard /> : <InventoryPage />
}

export default App

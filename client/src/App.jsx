import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AdminDashboard from './admin/AdminDashboard.jsx'
import PageNavigation from './components/PageNavigation.jsx'
import StudentBookingRoute from './student/booking/StudentBookingRoute.jsx'
import InventoryPage from './student/inventory/InventoryPage.jsx'
import './App.css'

export function AppRoutes() {
    return (
        <>
            <PageNavigation />
            <Routes>
                <Route path="/" element={<Navigate to="/inventory/students" replace />} />
                <Route path="/inventory" element={<Navigate to="/inventory/students" replace />} />
                <Route path="/inventory/students" element={
                    <div className="student-inventory-page"><InventoryPage /></div>
                } />
                <Route path="/student/booking" element={<StudentBookingRoute />} />
                <Route path="/inventory/admin" element={
                    <div className="admin-page"><AdminDashboard /></div>
                } />
                <Route path="/admin/bookings" element={<Navigate to="/inventory/admin" replace />} />
                <Route path="*" element={
                    <main className="missing-page">
                        <h1>Page not found</h1>
                        <p>Choose a page from the navigation above.</p>
                    </main>
                } />
            </Routes>
        </>
    )
}

function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    )
}

export default App

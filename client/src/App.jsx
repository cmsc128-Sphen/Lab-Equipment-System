import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import AuthProvider from './auth/AuthProvider.jsx'

import LoginPage from './auth/LoginPage.jsx'

import RegisterPage from './auth/RegisterPage.jsx'

import RequireAuth from './auth/RequireAuth.jsx'

import { useAuth } from './auth/AuthContext.js'

import { homeForRole } from './auth/roles.js'

import AdminDashboard from './admin/AdminDashboard.jsx'

import PageNavigation from './components/PageNavigation.jsx'

import StudentBookingRoute from './student/booking/StudentBookingRoute.jsx'

import InventoryPage from './student/inventory/InventoryPage.jsx'

import './App.css'

function AccountHome() {
    const { profile } = useAuth()

    return <Navigate to={homeForRole(profile.role)} replace />
}

export function AppRoutes() {
    return (
        <>
            <PageNavigation />
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route element={<RequireAuth />}>
                    <Route path="/" element={<AccountHome />} />
                    <Route path="/inventory" element={<AccountHome />} />
                    <Route element={<RequireAuth roles={['student']} />}>
                        <Route path="/inventory/students" element={
                            <div className="student-inventory-page"><InventoryPage /></div>
                        } />
                        <Route path="/student/booking" element={<StudentBookingRoute />} />
                    </Route>
                    <Route element={<RequireAuth roles={['lab_aid', 'admin']} />}>
                        <Route path="/inventory/admin" element={
                            <div className="admin-page"><AdminDashboard /></div>
                        } />
                        <Route path="/admin/bookings" element={<Navigate to="/inventory/admin" replace />} />
                    </Route>
                </Route>
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
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App

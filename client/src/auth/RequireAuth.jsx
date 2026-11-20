import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from './AuthContext.js'

import { homeForRole } from './roles.js'

export default function RequireAuth({ roles }) {
    const { profile, loading } = useAuth()

    const location = useLocation()

    if (loading) {
        return <main className="auth-loading" role="status">Checking your account…</main>
    }

    if (!profile) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />
    }

    if (roles && !roles.includes(profile.role)) {
        return <Navigate to={homeForRole(profile.role)} replace />
    }

    return <Outlet />
}

import { useState } from 'react'

import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from './AuthContext.js'

import { homeForRole, isAccountRole } from './roles.js'

export default function RequireAuth({ roles }) {
    const { profile, loading, retryProfile, signOut } = useAuth()

    const location = useLocation()

    const [signOutError, setSignOutError] = useState('')

    if (loading) {
        return <main className="auth-loading" role="status">Checking your account…</main>
    }

    if (!profile) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />
    }

    if (!isAccountRole(profile.role)) {
        async function leaveAccount() {
            setSignOutError('')

            try {
                await signOut()
            } catch (error) {
                setSignOutError(error.message || 'Unable to sign out. Try again.')
            }
        }

        return (
            <main className="auth-loading">
                <h1>Account access unavailable</h1>
                <p role="alert">Your account does not have a supported laboratory role. Contact lab staff to resolve access.</p>
                {signOutError && <p role="alert">{signOutError}</p>}
                <button type="button" onClick={retryProfile}>Retry account check</button>
                <button type="button" onClick={leaveAccount}>Sign out</button>
            </main>
        )
    }

    if (roles && !roles.includes(profile.role)) {
        const destination = homeForRole(profile.role)

        return destination
            ? <Navigate to={destination} replace />
            : <Navigate to="/login" replace />
    }

    return <Outlet />
}

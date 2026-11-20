import { useEffect, useRef, useState } from 'react'

import { Link, NavLink, useLocation } from 'react-router'

import { useAuth } from '../auth/AuthContext.js'

import departmentMark from '../student/booking/assets/department-mark.png'

export default function PageNavigation() {
    const { pathname } = useLocation()

    const { profile, signOut } = useAuth()

    const [failure, setFailure] = useState('')

    const [signingOut, setSigningOut] = useState(false)

    const accountDropdown = useRef(null)

    useEffect(() => {
        window.scrollTo(0, 0)

        if (accountDropdown.current) {
            accountDropdown.current.open = false
        }
    }, [pathname])

    if (!profile) {
        return null
    }

    async function logout() {
        setSigningOut(true)

        setFailure('')

        try {
            await signOut()
        } catch (error) {
            setFailure(error.message)
        } finally {
            setSigningOut(false)
        }
    }

    return (
        <header className="page-navigation">
            <Link className="page-navigation-brand" to="/inventory">
                <span className="page-navigation-mark" aria-hidden="true">
                    <img className="page-navigation-mark-circle" src="/images/header/logo-circle.svg" alt="" />
                    <img className="page-navigation-logo" src={departmentMark} width="56" height="56" alt="" />
                </span>
                <span>Lab Equipment System</span>
            </Link>
            <nav className="page-navigation-links" aria-label="Main navigation">
                {profile.role === 'student' ? (
                    <>
                        <NavLink to="/inventory/students">Inventory</NavLink>
                        <NavLink to="/student/booking">Booking</NavLink>
                    </>
                ) : (
                    <NavLink to="/inventory/admin">Booking review</NavLink>
                )}
            </nav>
            <details
                className="page-navigation-account"
                ref={accountDropdown}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        accountDropdown.current.open = false

                        accountDropdown.current.querySelector('summary').focus()
                    }
                }}
            >
                <summary>
                    <img src="/images/header/user-round.svg" alt="" />
                    <span>{profile.first_name} {profile.last_name}</span>
                    <img className="page-navigation-chevron" src="/images/header/chevron-down.svg" alt="" />
                </summary>
                <div className="page-navigation-account-panel">
                    <button type="button" onClick={logout} disabled={signingOut}>
                        {signingOut ? 'Logging out…' : 'Log out'}
                    </button>
                </div>
            </details>
            {failure && <p className="page-navigation-error" role="alert">{failure}</p>}
        </header>
    )
}

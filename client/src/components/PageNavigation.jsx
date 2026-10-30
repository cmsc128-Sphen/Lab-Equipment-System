import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'

export default function PageNavigation() {
    const { pathname } = useLocation()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [pathname])

    return (
        <nav className="page-navigation" aria-label="Page previews">
            <strong>Lab Equipment System</strong>
            <div className="page-navigation-links">
                <NavLink to="/inventory/students">Student inventory</NavLink>
                <NavLink to="/student/booking">Student booking</NavLink>
                <NavLink to="/inventory/admin">Admin review</NavLink>
            </div>
        </nav>
    )
}

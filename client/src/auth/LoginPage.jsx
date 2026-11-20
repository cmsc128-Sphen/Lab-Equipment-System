import { useRef, useState } from 'react'

import { Link, Navigate } from 'react-router'

import { useAuth } from './AuthContext.js'

import { homeForRole } from './roles.js'

import departmentMark from '../student/booking/assets/department-mark.png'

import './login.css'

export default function LoginPage() {
    const { profile, session, loading, error, signIn, signOut, retryProfile } = useAuth()

    const [email, setEmail] = useState('')

    const [password, setPassword] = useState('')

    const [submitting, setSubmitting] = useState(false)

    const [failure, setFailure] = useState('')

    const inFlight = useRef(false)

    if (profile) {
        return <Navigate to={homeForRole(profile.role)} replace />
    }

    async function submit(event) {
        event.preventDefault()

        if (inFlight.current) {
            return
        }

        inFlight.current = true

        setSubmitting(true)

        setFailure('')

        try {
            await signIn(email, password)

            setPassword('')
        } catch (error) {
            setFailure(error.message)
        } finally {
            inFlight.current = false

            setSubmitting(false)
        }
    }

    async function switchAccount() {
        setFailure('')

        try {
            await signOut()
        } catch (error) {
            setFailure(error.message)
        }
    }

    return (
        <div className="login-page">
            <header className="login-header">
                <img src={departmentMark} alt="" />
                <strong>Lab Equipment System</strong>
            </header>
            <main className="login-main">
                <section className="login-panel" aria-labelledby="login-title">
                    <h1 id="login-title">Log in</h1>
                    <p className="login-intro">Sign in with your laboratory account.</p>
                    {(failure || error) && <p className="login-error" role="alert">{failure || error}</p>}
                    {loading ? (
                        <p role="status">Checking your account…</p>
                    ) : session ? (
                        <div className="login-account-actions">
                            <button type="button" onClick={retryProfile}>Retry account check</button>
                            <button type="button" className="login-secondary" onClick={switchAccount}>Use another account</button>
                        </div>
                    ) : (
                        <form onSubmit={submit} aria-busy={submitting}>
                            <label htmlFor="login-email">Email</label>
                            <input id="login-email" name="email" type="email" autoComplete="username" required
                                value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} />
                            <label htmlFor="login-password">Password</label>
                            <input id="login-password" name="password" type="password" autoComplete="current-password" required
                                value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} />
                            <button type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</button>
                        </form>
                    )}
                    <p className="login-help">No account yet? <Link to="/register">Create an account</Link> with your UP email.</p>
                </section>
            </main>
        </div>
    )
}

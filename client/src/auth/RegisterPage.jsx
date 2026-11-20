import { useRef, useState } from 'react'

import { Link, Navigate } from 'react-router'

import { useAuth } from './AuthContext.js'

import { homeForRole } from './roles.js'

import { registerAccount, validateRegistration } from './registration.js'

import departmentMark from '../student/booking/assets/department-mark.png'

import './login.css'

const fields = [
    { name: 'firstName', label: 'First name', autoComplete: 'given-name', maxLength: 100 },
    { name: 'lastName', label: 'Last name', autoComplete: 'family-name', maxLength: 100 },
    { name: 'idNumber', label: 'University ID number', autoComplete: 'off', maxLength: 50 },
    { name: 'email', label: 'UP email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
]

export default function RegisterPage() {
    const { profile, session, loading } = useAuth()

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        idNumber: '',
        email: '',
        password: '',
        confirmPassword: '',
    })

    const [errors, setErrors] = useState({})

    const [failure, setFailure] = useState('')

    const [submitting, setSubmitting] = useState(false)

    const [submitted, setSubmitted] = useState(false)

    const inFlight = useRef(false)

    const feedback = useRef(null)

    if (profile) {
        return <Navigate to={homeForRole(profile.role)} replace />
    }

    if (session && !loading) {
        return <Navigate to="/login" replace />
    }

    function changeField(event) {
        const { name, value } = event.target

        setForm((current) => ({ ...current, [name]: value }))

        setErrors((current) => ({ ...current, [name]: undefined }))
    }

    async function submit(event) {
        event.preventDefault()

        if (inFlight.current) {
            return
        }

        const nextErrors = validateRegistration(form)

        setErrors(nextErrors)

        setFailure('')

        if (Object.keys(nextErrors).length) {
            const firstField = Object.keys(nextErrors)[0]

            event.currentTarget.elements.namedItem(firstField)?.focus()

            return
        }

        inFlight.current = true

        setSubmitting(true)

        try {
            const redirectUrl = new URL('/login', window.location.origin).href

            await registerAccount(form, redirectUrl)

            setForm((current) => ({ ...current, password: '', confirmPassword: '' }))

            setSubmitted(true)

            requestAnimationFrame(() => feedback.current?.focus())
        } catch (error) {
            setFailure(error.message)
        } finally {
            inFlight.current = false

            setSubmitting(false)
        }
    }

    return (
        <div className="login-page">
            <header className="login-header">
                <img src={departmentMark} alt="" />
                <strong>Lab Equipment System</strong>
            </header>
            <main className="login-main register-main">
                <section className="login-panel register-panel" aria-labelledby="register-title">
                    <h1 id="register-title">Create an account</h1>
                    <p className="login-intro">Register with your @up.edu.ph email. Verify your email to start borrowing.</p>
                    {failure && <p className="login-error" role="alert">{failure}</p>}
                    {loading ? (
                        <p role="status">Checking your account…</p>
                    ) : submitted ? (
                        <div className="register-success" role="status" tabIndex={-1} ref={feedback}>
                            <h2>Check your UP email</h2>
                            <p>Follow the confirmation link to verify your email, then log in. No staff approval is needed.</p>
                            <p>If you already have an account, you can log in instead.</p>
                        </div>
                    ) : (
                        <form onSubmit={submit} aria-busy={submitting}>
                            <div className="register-fields">
                                {fields.map((field) => (
                                    <div className={`register-field register-${field.name}`} key={field.name}>
                                        <label htmlFor={`register-${field.name}`}>{field.label}</label>
                                        <input
                                            id={`register-${field.name}`}
                                            name={field.name}
                                            type={field.type || 'text'}
                                            autoComplete={field.autoComplete}
                                            maxLength={field.maxLength}
                                            required
                                            disabled={submitting}
                                            value={form[field.name]}
                                            onChange={changeField}
                                            aria-invalid={Boolean(errors[field.name])}
                                            aria-describedby={errors[field.name] ? `error-${field.name}` : undefined}
                                        />
                                        {field.name === 'password' && <small>Use at least 8 characters.</small>}
                                        {errors[field.name] && <p className="register-field-error" id={`error-${field.name}`}>{errors[field.name]}</p>}
                                    </div>
                                ))}
                            </div>
                            <button type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
                        </form>
                    )}
                    <p className="login-help">Already registered? <Link to="/login">Log in</Link></p>
                </section>
            </main>
        </div>
    )
}

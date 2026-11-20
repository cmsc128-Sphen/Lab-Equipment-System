import test from 'node:test'

import assert from 'node:assert/strict'

import { registerAccount, validateRegistration } from './registration.js'

const validForm = {
    firstName: ' Sample ',
    lastName: ' Student ',
    idNumber: ' 2026-00001 ',
    email: ' student@up.edu.ph ',
    password: 'Test-password-only',
    confirmPassword: 'Test-password-only',
}

test('registration accepts the exact UP domain and rejects lookalikes and subdomains', () => {
    // Domain matching ignores case and surrounding input whitespace.
    for (const email of ['student@up.edu.ph', 'Student@UP.EDU.PH', ' student@up.edu.ph ']) {
        assert.equal(validateRegistration({ ...validForm, email }).email, undefined)
    }

    for (const email of ['student@gmail.com', 'student@upv.edu.ph', 'student@students.up.edu.ph', 'student@up.edu.ph.evil.test', 'student@fakeup.edu.ph', 'a@b@up.edu.ph', '@up.edu.ph', 'a b@up.edu.ph']) {
        assert.match(validateRegistration({ ...validForm, email }).email, /@up.edu.ph/)
    }
})

test('registration validates identity fields, password length and password confirmation', () => {
    const errors = validateRegistration({
        ...validForm,
        firstName: ' ',
        lastName: 'a'.repeat(101),
        idNumber: '',
        password: 'short',
    })

    assert.deepEqual(Object.keys(errors), ['firstName', 'lastName', 'idNumber', 'password', 'confirmPassword'])
})

test('signup sends normalized identity fields without granting roles or sending password confirmation', async () => {
    let submitted

    const client = {
        auth: {
            async signUp(payload) {
                submitted = payload

                return { error: null }
            },
        },
    }

    // Extra form fields must never become role or activation assignments.
    await registerAccount({ ...validForm, role: 'admin', is_active: true }, 'http://localhost:5173/login', client)

    assert.deepEqual(submitted, {
        email: 'student@up.edu.ph',
        password: validForm.password,
        options: {
            emailRedirectTo: 'http://localhost:5173/login',
            data: { id_number: '2026-00001', first_name: 'Sample', last_name: 'Student' },
        },
    })
})

test('invalid addresses never reach Auth and provider failures return safe feedback', async () => {
    let attempts = 0

    const client = {
        auth: {
            async signUp() {
                attempts += 1

                return { error: { code: 'unexpected_failure', message: 'Private database details' } }
            },
        },
    }

    await assert.rejects(registerAccount({ ...validForm, email: 'student@gmail.com' }, '', client), /@up.edu.ph/)

    assert.equal(attempts, 0)

    await assert.rejects(registerAccount(validForm, '', client), {
        message: 'Unable to create your account. Check your ID number and details, or try again later.',
    })
})

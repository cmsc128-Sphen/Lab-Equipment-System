import { getSupabase } from './supabase.js'

export function validateRegistration(form) {
    const errors = {}

    if (!form.firstName.trim() || form.firstName.trim().length > 100) {
        errors.firstName = 'Enter your first name using 100 characters or fewer.'
    }

    if (!form.lastName.trim() || form.lastName.trim().length > 100) {
        errors.lastName = 'Enter your last name using 100 characters or fewer.'
    }

    if (!form.idNumber.trim() || form.idNumber.trim().length > 50) {
        errors.idNumber = 'Enter your university ID number using 50 characters or fewer.'
    }

    if (!/^[^@\s]+@up\.edu\.ph$/i.test(form.email.trim())) {
        errors.email = 'Use an email address ending in @up.edu.ph.'
    }

    if (form.password.length < 8) {
        errors.password = 'Use at least 8 characters.'
    }

    if (form.password !== form.confirmPassword) {
        errors.confirmPassword = 'Your passwords do not match.'
    }

    return errors
}

export async function registerAccount(form, redirectUrl, client = getSupabase()) {
    const errors = validateRegistration(form)

    if (Object.keys(errors).length) {
        throw new Error(Object.values(errors)[0])
    }

    // Profile identity comes from these fields; the database assigns the student role.
    const { error } = await client.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
            emailRedirectTo: redirectUrl,
            data: {
                id_number: form.idNumber.trim(),
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
            },
        },
    })

    if (error) {
        if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
            throw new Error('Too many attempts. Please wait a few minutes before trying again.')
        }

        if (error.code === 'weak_password') {
            throw new Error('Choose a stronger password and try again.')
        }

        throw new Error('Unable to create your account. Check your ID number and details, or try again later.')
    }
}

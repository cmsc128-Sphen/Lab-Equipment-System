export async function loadAccount(session, signal, fetchAccount = fetch) {
    let response

    try {
        response = await fetchAccount('/api/auth/me', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            signal,
            cache: 'no-store',
        })
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('Checking your account timed out. Please retry.')
        }

        throw new Error('Unable to reach the account service. Please try again.')
    }

    let result

    try {
        result = await response.json()
    } catch {
        // A stopped backend can make the development proxy return an empty error response.
        throw new Error('The account service returned an invalid response. Please try again.')
    }

    if (!response.ok) {
        const message = result?.error?.message

        throw new Error(typeof message === 'string' ? message : 'Unable to load your account. Please try again.')
    }

    const profile = result?.profile

    const validProfile = profile?.id === session.user.id
        && result?.user?.id === session.user.id
        && profile.is_active === true
        && ['student', 'lab_aid', 'admin'].includes(profile.role)

    if (!validProfile) {
        throw new Error('The server returned an invalid account profile.')
    }

    return profile
}

import { useEffect, useState } from 'react'

import { AuthContext } from './AuthContext.js'

import { getSupabase } from './supabase.js'

export default function AuthProvider({ children }) {
    const [account, setAccount] = useState({
        session: null,
        profile: null,
        loading: true,
        error: '',
    })

    const [retry, setRetry] = useState(0)

    useEffect(() => {
        let active = true

        let version = 0

        let controller

        let timer

        let subscription

        try {
            const supabase = getSupabase()

            const listener = supabase.auth.onAuthStateChange((_event, session) => {
                if (!active) {
                    return
                }

                version += 1

                const currentVersion = version

                clearTimeout(timer)

                controller?.abort()

                // Keep an already verified user's page mounted during token refreshes.
                setAccount((current) => {
                    const sameUser = session && current.session?.user.id === session.user.id

                    if (sameUser && current.profile) {
                        return { ...current, session }
                    }

                    return { session, profile: null, loading: Boolean(session), error: '' }
                })

                if (!session) {
                    return
                }

                // Defer API work until Supabase has released its auth callback lock.
                timer = setTimeout(async () => {
                    controller = new AbortController()

                    try {
                        const response = await fetch('/api/auth/me', {
                            headers: { Authorization: `Bearer ${session.access_token}` },
                            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
                            cache: 'no-store',
                        })

                        const result = await response.json()

                        if (!response.ok) {
                            throw new Error(result.error?.message || 'Unable to load your account. Try again.')
                        }

                        if (!result.profile || result.user?.id !== session.user.id) {
                            throw new Error('The server returned an invalid account profile.')
                        }

                        if (active && currentVersion === version) {
                            setAccount({ session, profile: result.profile, loading: false, error: '' })
                        }
                    } catch (error) {
                        if (active && currentVersion === version) {
                            setAccount({ session, profile: null, loading: false, error: error.message || 'Unable to load your account.' })
                        }
                    }
                }, 0)
            })

            subscription = listener.data.subscription
        } catch (error) {
            timer = setTimeout(() => {
                if (active) {
                    setAccount({ session: null, profile: null, loading: false, error: error.message })
                }
            }, 0)
        }

        return () => {
            active = false

            clearTimeout(timer)

            controller?.abort()

            subscription?.unsubscribe()
        }
    }, [retry])

    async function signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({
            email: email.trim(),
            password,
        })

        if (error) {
            if (error.code === 'email_not_confirmed') {
                throw new Error('Verify your email before signing in.')
            }

            if (error.code === 'invalid_credentials') {
                throw new Error('Email or password is incorrect.')
            }

            throw new Error('Unable to sign in right now. Try again shortly.')
        }
    }

    async function signOut() {
        const { error } = await getSupabase().auth.signOut({ scope: 'local' })

        if (error) {
            throw new Error('Unable to sign out. Try again.')
        }
    }

    return (
        <AuthContext.Provider value={{ ...account, signIn, signOut, retryProfile: () => setRetry((value) => value + 1) }}>
            {children}
        </AuthContext.Provider>
    )
}

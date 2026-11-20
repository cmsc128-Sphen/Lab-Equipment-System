import { createClient } from '@supabase/supabase-js'

let supabase

export function getSupabase() {
    if (!supabase) {
        const url = import.meta.env.VITE_SUPABASE_URL

        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

        if (!url || !key) {
            throw new Error('Login is not configured. Set the Supabase URL and publishable key in client/.env.')
        }

        supabase = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        })
    }

    return supabase
}

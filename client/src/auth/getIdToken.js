import { getSupabase } from './supabase.js'

export async function getIdToken() {
    const { data, error } = await getSupabase().auth.getSession()

    if (error) {
        throw new Error('Unable to restore your session. Sign in again.')
    }

    return data.session?.access_token ?? null
}

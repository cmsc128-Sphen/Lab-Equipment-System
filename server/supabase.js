const { createClient } = require('@supabase/supabase-js');

let supabase;

function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;

        const key = process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
            throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in server/.env.');
        }

        supabase = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        });

        // INFO after creating the SDK client; no remote request has succeeded yet.
        console.log('[INFO] supabase.client_initialized connectivity=not_checked');
    }

    return supabase;
}

async function checkSupabaseConnection() {
    // INFO before checking the configured project's public settings; no credentials are logged.
    console.log('[INFO] supabase.connection_check_started');

    try {
        getSupabase();

        const endpoint = new URL('/auth/v1/settings', process.env.SUPABASE_URL);

        const response = await fetch(endpoint, {
            headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY },
            signal: AbortSignal.timeout(10000),
            redirect: 'error',
        });

        if (!response.ok) {
            throw new Error('Supabase rejected the connection check.');
        }

        const settings = await response.json();

        if (!settings.external || typeof settings.external !== 'object') {
            throw new Error('Supabase returned an unexpected settings response.');
        }

        // INFO after the API accepts the key; table access and database permissions are not tested.
        console.log('[INFO] supabase.connection_check_completed database=not_checked');

        return { status: 'ok', supabase: 'reachable', database: 'not_checked' };
    } catch {
        // WARN for failed configuration or a remote request; return a safe error and allow a later retry.
        console.warn('[WARN] supabase.connection_check_failed nextAction=check_env_or_retry');

        throw new Error('Could not reach Supabase. Check the project status and server/.env settings.');
    }
}

function createUserClient(accessToken) {
    // Check configuration using the existing initialization path.
    getSupabase();

    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
        global: {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}

module.exports = { getSupabase, createUserClient, checkSupabaseConnection };

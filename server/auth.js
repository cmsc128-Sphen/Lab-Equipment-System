const { createUserClient } = require('./supabase');

const roles = ['student', 'lab_aid', 'admin'];

function createAuthenticationMiddleware(createClient = createUserClient) {
    return async function requireAuthentication(request, response, next) {
        response.set('Cache-Control', 'no-store');

        const authorization = request.get('Authorization') || '';

        const match = authorization.match(/^Bearer ([^\s]+)$/i);

        if (!match) {
            return response.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
            });
        }

        try {
            // Each request gets its own client so users never share authorization headers.
            const supabase = createClient(match[1]);

            const { data, error } = await supabase.auth.getUser(match[1]);

            if (error || !data.user) {
                const unavailable = error && (!error.status || error.status === 429 || error.status >= 500);

                return response.status(unavailable ? 503 : 401).json({
                    error: {
                        code: unavailable ? 'AUTH_UNAVAILABLE' : 'UNAUTHENTICATED',
                        message: unavailable ? 'Unable to check your account. Try again.' : 'Your session has expired. Sign in again.',
                    },
                });
            }

            if (!data.user.email_confirmed_at || data.user.is_anonymous) {
                return response.status(403).json({
                    error: { code: 'EMAIL_UNVERIFIED', message: 'Verify your email before signing in.' },
                });
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, id_number, first_name, last_name, role, is_active')
                .eq('id', data.user.id)
                .maybeSingle();

            if (profileError) {
                return response.status(503).json({
                    error: { code: 'PROFILE_UNAVAILABLE', message: 'Unable to load your profile. Try again.' },
                });
            }

            // RLS also hides profiles belonging to inactive or banned accounts.
            if (!profile || !profile.is_active || !roles.includes(profile.role)) {
                return response.status(403).json({
                    error: { code: 'ACCOUNT_UNAVAILABLE', message: 'Your account has no active laboratory profile. Contact lab staff.' },
                });
            }

            request.auth = {
                user: { id: data.user.id, email: data.user.email },
                profile,
                supabase,
            };

            return next();
        } catch {
            return response.status(503).json({
                error: { code: 'AUTH_UNAVAILABLE', message: 'Unable to check your account. Try again.' },
            });
        }
    };
}

function requireRoles(...allowedRoles) {
    return function checkRole(request, response, next) {
        if (!request.auth) {
            return response.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
            });
        }

        if (!allowedRoles.includes(request.auth.profile.role)) {
            return response.status(403).json({
                error: { code: 'FORBIDDEN', message: 'Your account cannot access this feature.' },
            });
        }

        return next();
    };
}

module.exports = { createAuthenticationMiddleware, requireRoles };

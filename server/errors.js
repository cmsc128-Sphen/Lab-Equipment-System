const requestErrors = new Map([
    ['entity.parse.failed', { status: 400, code: 'INVALID_JSON', message: 'The request body must contain valid JSON.' }],
    ['entity.too.large', { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body exceeds the 100 KB limit.' }],
    ['charset.unsupported', { status: 415, code: 'UNSUPPORTED_CHARSET', message: 'Use UTF-8 encoded JSON.' }],
    ['encoding.unsupported', { status: 415, code: 'UNSUPPORTED_ENCODING', message: 'The request uses an unsupported content encoding.' }],
    ['request.size.invalid', { status: 400, code: 'INVALID_REQUEST_SIZE', message: 'The request body does not match its declared size.' }],
    ['request.aborted', { status: 400, code: 'REQUEST_ABORTED', message: 'The request body was not received completely.' }],
]);

function apiErrorHandler(error, _request, response, next) {
    if (response.headersSent) {
        return next(error);
    }

    const requestError = requestErrors.get(error?.type);

    const result = requestError || {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred. Please try again.',
    };

    if (requestError) {
        // WARN for rejected request bodies; log only the fixed code/status, never body-parser's body or message.
        console.warn(`[WARN] api.request_rejected code=${result.code} status=${result.status} nextAction=correct_request`);
    } else {
        // ERROR for unexpected failures; omit exception content, credentials and stack paths from logs and responses.
        console.error('[ERROR] api.request_failed code=INTERNAL_ERROR status=500 nextAction=investigate');
    }

    response.set('Cache-Control', 'no-store');

    return response.status(result.status).json({
        error: { code: result.code, message: result.message },
    });
}

module.exports = { apiErrorHandler };

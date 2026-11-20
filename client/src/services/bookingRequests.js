const sessionExpired = 'Your session has expired. Sign in again, then submit. Your entries are kept.'
const unreachable = 'Could not reach the server. Your entries are still here. Submit again; your request will not be saved twice.'
const unconfirmed = "We couldn't confirm your request was saved. Submit again; it will not be saved twice."

function failure(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

/** Adapt the agreed API endpoint without coupling the page to an auth provider.
 * Errors carry a code: SESSION_EXPIRED, NETWORK, UNCERTAIN, or the server's error code.
 */
export function createRequestSubmitter({ endpoint, getAccessToken, fetchImpl = fetch, timeoutMs = 20000 }) {
  return async (payload) => {
    let token
    try {
      token = await getAccessToken()
    } catch {
      token = null
    }
    if (!token) throw failure(sessionExpired, 'SESSION_EXPIRED')
    let response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        // A hung request would otherwise keep the form locked.
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw failure(unreachable, 'NETWORK')
    }
    if (response.status === 401) throw failure(sessionExpired, 'SESSION_EXPIRED')
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      const message = typeof data?.error?.message === 'string' ? data.error.message : typeof data?.message === 'string' ? data.message : 'The request could not be saved. Your entries are still here; please try again.'
      throw failure(message, typeof data?.error?.code === 'string' ? data.error.code : 'REQUEST_FAILED')
    }
    try {
      return await response.json()
    } catch {
      throw failure(unconfirmed, 'UNCERTAIN')
    }
  }
}

/** Adapt the agreed API endpoint without coupling the page to an auth provider. */
export function createRequestSubmitter({ endpoint, getAccessToken, fetchImpl = fetch }) {
  return async (payload) => {
    const token = await getAccessToken()
    if (!token) throw new Error('Your session has expired. Sign in again before submitting. Your entries are still here.')
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    if (response.status === 401) throw new Error('Your session has expired. Sign in again before submitting. Your entries are still here.')
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(typeof data?.message === 'string' ? data.message : 'The request could not be saved. Your entries are still here; please try again.')
    }
    return response.json()
  }
}

export const demoInventory = [
  { id: 'demo-beaker', name: 'Beaker · 250 mL', category: 'equipment', unit: 'pcs', available: 12 },
  { id: 'demo-sodium-chloride', name: 'Sodium chloride', category: 'chemical', unit: 'g', available: 250 },
  { id: 'demo-cylinder', name: 'Graduated cylinder · 100 mL', category: 'equipment', unit: 'pcs', available: 8 },
  { id: 'demo-ethanol', name: 'Ethanol', category: 'chemical', unit: 'mL', available: 500 },
]

export async function submitDemoRequest() {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { reference: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'Pending' }
}

function demoFailure(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

/** Preview-only failure modes for checking retry behaviour (?simulate=network|session|stock|lost).
 * Each fails the first attempt, then saves; saved references are remembered per submission key.
 */
export function createDemoSubmitter(mode) {
  const saved = new Map()
  let attempts = 0
  return async (payload) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    attempts += 1
    console.info(`[preview] attempt ${attempts} key=${payload.submissionKey}`)
    if (saved.has(payload.submissionKey)) {
      console.info(`[preview] replayed ${saved.get(payload.submissionKey).reference}`)
      return saved.get(payload.submissionKey)
    }
    if (attempts === 1 && mode === 'network') throw demoFailure('Could not reach the server. Your entries are still here. Submit again; your request will not be saved twice.', 'NETWORK')
    if (attempts === 1 && mode === 'session') throw demoFailure('Your session has expired. Sign in again, then submit. Your entries are kept.', 'SESSION_EXPIRED')
    if (attempts === 1 && mode === 'stock') throw demoFailure('An item no longer has enough stock. Reload the page and lower the quantity.', 'BOOKING_STOCK_EXCEEDED')
    const result = { reference: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'Pending' }
    saved.set(payload.submissionKey, result)
    console.info(`[preview] saved ${result.reference}`)
    // The save "commits" but the response is lost, as after a dropped connection.
    if (attempts === 1 && mode === 'lost') throw demoFailure("We couldn't confirm your request was saved. Submit again; it will not be saved twice.", 'UNCERTAIN')
    return result
  }
}

export function getInventoryState({ loading, error, items }) {
  if (loading) return 'loading'
  if (error) return 'error'
  if (items.length === 0) return 'empty'
  return 'ready'
}

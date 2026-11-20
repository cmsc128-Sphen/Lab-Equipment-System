export function filterInventoryItems(items, { query, category, availability }) {
  const normalizedQuery = query.trim().toLowerCase()

  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      [item.name, item.code, item.categoryName, item.type].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      )
    const matchesCategory = category === 'All' || item.categoryName === category
    const isInStock = item.stock.available > 0
    const matchesAvailability =
      availability === 'All' ||
      (availability === 'in-stock' && isInStock) ||
      (availability === 'out-of-stock' && !isInStock)

    return matchesQuery && matchesCategory && matchesAvailability
  })
}

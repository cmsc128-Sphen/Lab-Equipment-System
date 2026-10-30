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

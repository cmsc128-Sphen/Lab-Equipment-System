// To view this catalogue in the inventory page, set USE_MOCK_DATA=true in
// client/.env.local, run `npm run dev` from client, then open
// http://localhost:5173/inventory.
const inventory = [
  ['microscope-compound', 'Compound Microscope', 'equipment', 'microscopes', 'Microscopes', 'pcs', 1200, 0, 200, 0],
  ['microscope-dissecting', 'Dissecting Microscope', 'equipment', 'microscopes', 'Microscopes', 'pcs', 800, 0, 100, 0],
  ['balance-analytical', 'Analytical Balance', 'equipment', 'measuring-equipment', 'Measuring Equipment', 'pcs', 500, 100, 100, 0],
  ['balance-top-loading', 'Top-loading Balance', 'equipment', 'measuring-equipment', 'Measuring Equipment', 'pcs', 900, 0, 100, 0],
  ['centrifuge-bench', 'Bench Centrifuge', 'equipment', 'centrifuges', 'Centrifuges', 'pcs', 400, 0, 100, 0],
  ['centrifuge-micro', 'Microcentrifuge', 'equipment', 'centrifuges', 'Centrifuges', 'pcs', 600, 0, 200, 0],
  ['hot-plate', 'Hot Plate', 'equipment', 'heating-equipment', 'Heating Equipment', 'pcs', 1000, 0, 200, 0],
  ['magnetic-stirrer', 'Magnetic Stirrer', 'equipment', 'heating-equipment', 'Heating Equipment', 'pcs', 800, 100, 100, 0],
  ['water-bath', 'Water Bath', 'equipment', 'heating-equipment', 'Heating Equipment', 'pcs', 500, 0, 100, 0],
  ['ph-meter', 'Digital pH Meter', 'equipment', 'measuring-equipment', 'Measuring Equipment', 'pcs', 700, 100, 100, 0],
  ['spectrophotometer', 'Spectrophotometer', 'equipment', 'measuring-equipment', 'Measuring Equipment', 'pcs', 300, 0, 100, 0],
  ['micropipette', 'Micropipette Set', 'equipment', 'pipettes', 'Pipettes', 'pcs', 1100, 100, 200, 0],
  ['pipette-controller', 'Pipette Controller', 'equipment', 'pipettes', 'Pipettes', 'pcs', 600, 0, 100, 0],
  ['bunsen-burner', 'Bunsen Burner', 'equipment', 'heating-equipment', 'Heating Equipment', 'pcs', 1500, 100, 200, 0],
  ['autoclave-tabletop', 'Tabletop Autoclave', 'equipment', 'sterilization', 'Sterilization Equipment', 'pcs', 200, 0, 100, 0],
  ['incubator', 'Laboratory Incubator', 'equipment', 'sterilization', 'Sterilization Equipment', 'pcs', 300, 0, 100, 0],
  ['ethanol-95', 'Ethanol 95%', 'chemical', 'solvents', 'Solvents', 'mL', 235000, 10000, 5000, 0],
  ['methanol', 'Methanol', 'chemical', 'solvents', 'Solvents', 'mL', 120000, 5000, 0, 0],
  ['acetone', 'Acetone', 'chemical', 'solvents', 'Solvents', 'mL', 80000, 10000, 0, 0],
  ['isopropyl-alcohol', 'Isopropyl Alcohol', 'chemical', 'solvents', 'Solvents', 'mL', 65000, 5000, 0, 0],
  ['hydrochloric-acid', 'Hydrochloric Acid', 'chemical', 'acids', 'Acids', 'mL', 45000, 5000, 0, 0],
  ['sulfuric-acid', 'Sulfuric Acid', 'chemical', 'acids', 'Acids', 'mL', 38000, 3000, 0, 0],
  ['acetic-acid', 'Acetic Acid', 'chemical', 'acids', 'Acids', 'mL', 52000, 8000, 0, 0],
  ['sodium-hydroxide', 'Sodium Hydroxide', 'chemical', 'bases', 'Bases', 'g', 25000, 5000, 0, 0],
  ['potassium-hydroxide', 'Potassium Hydroxide', 'chemical', 'bases', 'Bases', 'g', 18000, 3000, 0, 0],
  ['sodium-chloride', 'Sodium Chloride', 'chemical', 'salts', 'Salts', 'g', 60000, 10000, 0, 0],
  ['copper-sulfate', 'Copper Sulfate', 'chemical', 'salts', 'Salts', 'g', 22000, 2000, 0, 0],
  ['potassium-permanganate', 'Potassium Permanganate', 'chemical', 'salts', 'Salts', 'g', 15000, 3000, 0, 0],
  ['hydrogen-peroxide', 'Hydrogen Peroxide 3%', 'chemical', 'oxidizers', 'Oxidizers', 'mL', 42000, 5000, 0, 0],
  ['iodine-solution', 'Iodine Solution', 'chemical', 'indicators', 'Indicators', 'mL', 12000, 2000, 0, 0],
  ['phenolphthalein', 'Phenolphthalein Indicator', 'chemical', 'indicators', 'Indicators', 'mL', 9000, 1000, 0, 0],
  ['distilled-water', 'Distilled Water', 'chemical', 'solutions', 'Solutions', 'L', 50000, 10000, 0, 0],
  ['buffer-ph7', 'pH 7 Buffer Solution', 'chemical', 'solutions', 'Solutions', 'mL', 30000, 5000, 0, 0],
  ['filter-paper', 'Filter Paper', 'disposable', 'paper-goods', 'Paper Goods', 'pcs', 15000, 1000, 0, 0],
  ['nitrile-gloves', 'Nitrile Gloves', 'disposable', 'disposable-protective-equipment', 'Disposable Protective Equipment', 'pcs', 24000, 2000, 0, 0],
  ['safety-goggles', 'Safety Goggles', 'equipment', 'protective-equipment', 'Protective Equipment', 'pcs', 1800, 200, 0, 0],
  ['pipette-tips', 'Micropipette Tips', 'disposable', 'plasticware', 'Plasticware', 'pcs', 32000, 2000, 0, 0],
  ['test-tubes', 'Glass Test Tubes', 'equipment', 'glassware', 'Glassware', 'pcs', 7500, 500, 100, 0],
  ['beaker-250ml', 'Beaker 250 mL', 'equipment', 'glassware', 'Glassware', 'pcs', 4200, 200, 100, 0],
  ['graduated-cylinder', 'Graduated Cylinder 100 mL', 'equipment', 'glassware', 'Glassware', 'pcs', 2600, 200, 0, 0],
  ['petri-dish', 'Petri Dish', 'disposable', 'plasticware', 'Plasticware', 'pcs', 50000, 5000, 0, 0],
  ['weighing-boats', 'Weighing Boats', 'disposable', 'plasticware', 'Plasticware', 'pcs', 18000, 1000, 0, 0],
  ['discontinued-reagent', 'Discontinued Reagent', 'chemical', 'archived-chemicals', 'Archived Chemicals', 'mL', 0, 0, 0, 0],
]

export const mockItems = inventory.map(
  ([id, name, type, categoryId, categoryName, unit, available, reserved, checkedOut, unusable], index) => {
    const nameLower = name.toLowerCase()
    const isActive = index !== inventory.length - 1
    const stock = {
      total: available + reserved + checkedOut + unusable,
      available,
      reserved,
      checkedOut,
      unusable,
    }

    return {
      id,
      code: `LES-${id.toUpperCase()}`,
      name,
      nameLower,
      type,
      categoryId,
      categoryName,
      unit,
      quantityScale: 100,
      stock,
      status:
        available > 0
          ? 'available'
          : reserved > 0 || checkedOut > 0
            ? 'in_use'
            : 'out_of_stock',
      searchText: `${nameLower} ${categoryName.toLowerCase()}`,
      isActive,
      primaryImage: null,
      chemical: null,
    }
  },
)

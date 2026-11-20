import { useEffect, useState } from 'react'
import { getItems } from '../../data/items.js'
import BookingPage from './BookingPage.jsx'
import { submitDemoRequest } from './demo.js'

const useMockData = import.meta.env.USE_MOCK_DATA === 'true'

// Booking needs { id, name, category: 'equipment'|'chemical', unit, available } in display units.
function toBookingItem(item) {
    return {
        id: item.id,
        name: item.name,
        category: item.type === 'chemical' ? 'chemical' : 'equipment',
        categoryName: item.categoryName,
        unit: item.unit,
        available: item.stock.available / item.quantityScale,
    }
}

export default function StudentBookingRoute() {
    const [inventory, setInventory] = useState([])
    const [inventoryNote, setInventoryNote] = useState('Loading inventory…')

    useEffect(() => {
        let active = true
        getItems()
            .then(({ items }) => {
                if (!active) return
                setInventory(items.map(toBookingItem))
                setInventoryNote(useMockData ? 'Sample inventory for the booking preview.' : '')
            })
            .catch((error) => { if (active) setInventoryNote(error.message) })
        return () => { active = false }
    }, [])

    return (
        <div className="booking-app">
            <header className="booking-topbar">
                <span className="booking-brand"><span className="booking-brand-mark" aria-hidden="true">L</span>Lab Equipment System</span>
                <span className="booking-topbar-link">Booking</span>
            </header>
            <BookingPage
                inventory={inventory}
                inventoryNote={inventoryNote}
                submitRequest={useMockData ? submitDemoRequest : undefined}
                demo={useMockData}
            />
        </div>
    )
}

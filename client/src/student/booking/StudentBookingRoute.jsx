import { useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthContext.js'

import { getItems } from '../../data/items.js'

import { toBookingItem } from '../../data/inventoryClient.js'

import BookingPage from './BookingPage.jsx'

export default function StudentBookingRoute() {
    const { profile } = useAuth()

    const [inventory, setInventory] = useState([])
    const [inventoryNote, setInventoryNote] = useState('Loading inventory…')

    useEffect(() => {
        let active = true

        const controller = new AbortController()

        getItems({ signal: controller.signal })
            .then(({ items }) => {
                if (!active) return
                setInventory(items.map(toBookingItem))
                setInventoryNote(items.length ? '' : 'No active inventory items are available.')
            })
            .catch((error) => { if (active) setInventoryNote(error.message) })
        return () => {
            active = false

            controller.abort()
        }
    }, [])

    return (
        <div className="booking-app student-booking-page">
            <BookingPage
                borrower={{ studentId: profile.id_number }}
                inventory={inventory}
                inventoryNote={inventoryNote}
            />
        </div>
    )
}

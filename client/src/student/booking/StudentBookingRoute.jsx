import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthContext.js'

import { getItems } from '../../data/items.js'

import { toBookingItem } from '../../data/inventoryClient.js'

import { readInventoryCart, writeInventoryCart } from '../inventoryCart.js'

import BookingPage from './BookingPage.jsx'

export default function StudentBookingRoute() {
    const { profile } = useAuth()

    const [inventory, setInventory] = useState([])
    const [inventoryNote, setInventoryNote] = useState('Loading inventory…')

    // The inventory page's booking cart is the draft; it is only stored in this browser until a request is saved.
    const [cart] = useState(() => {
        try {
            return { items: readInventoryCart(), error: '' }
        } catch (error) {
            return { items: [], error: error.message }
        }
    })
    const [cartError, setCartError] = useState(cart.error)

    const saveDraft = useCallback((items) => {
        // An unreadable cart is left for the inventory page's message instead of being overwritten.
        if (cart.error) return
        try {
            writeInventoryCart(items)
        } catch (error) {
            setCartError(error.message)
        }
    }, [cart.error])

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
                initialItems={cart.items}
                onDraftChange={saveDraft}
                draftNote={cartError}
                inventory={inventory}
                inventoryNote={inventoryNote}
            />
        </div>
    )
}

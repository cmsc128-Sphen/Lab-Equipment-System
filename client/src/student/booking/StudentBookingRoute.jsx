import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthContext.js'

import { getItems } from '../../data/items.js'

import { toBookingItem } from '../../data/inventoryClient.js'

import { readInventoryCart, writeInventoryCart } from '../inventoryCart.js'

import BookingPage from './BookingPage.jsx'

export default function StudentBookingRoute() {
    const { profile } = useAuth()
    return <StudentBookingContent key={profile.id} profile={profile} />
}

function StudentBookingContent({ profile }) {
    const [inventory, setInventory] = useState([])
    const [inventoryNote, setInventoryNote] = useState('Loading inventory…')

    function loadCart(userId) {
        try {
            return { userId, items: readInventoryCart(userId), error: '' }
        } catch (error) {
            return { userId, items: [], error: error.message }
        }
    }

    // The inventory page's booking cart is the draft; it is only stored in this browser until a request is saved.
    const [cart] = useState(() => loadCart(profile.id))
    const activeCart = cart.userId === profile.id ? cart : { userId: profile.id, items: [], error: '' }
    const [cartError, setCartError] = useState(activeCart.error)

    const saveDraft = useCallback((items) => {
        // An unreadable cart is left for the inventory page's message instead of being overwritten.
        if (activeCart.error) return
        try {
            writeInventoryCart(profile.id, items)
        } catch (error) {
            setCartError(error.message)
        }
    }, [activeCart.error, profile.id])

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

    if (cart.userId !== profile.id) {
        return <main className="auth-loading" role="status">Loading your booking cart…</main>
    }

    return (
        <div className="booking-app student-booking-page">
            <BookingPage
                key={profile.id}
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

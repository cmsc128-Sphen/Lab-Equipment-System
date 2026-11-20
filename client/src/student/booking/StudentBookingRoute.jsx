import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthContext.js'

import { getIdToken } from '../../auth/getIdToken.js'

import { getItems } from '../../data/items.js'

import { createRequestSubmitter } from '../../services/bookingRequests.js'

import { toBookingItem } from '../../data/inventoryClient.js'

import { readInventoryCart, writeInventoryCart } from '../inventoryCart.js'

import BookingPage from './BookingPage.jsx'

const submitRequest = createRequestSubmitter({ endpoint: '/api/bookings', getAccessToken: getIdToken })

const FORM_KEY = 'lab-equipment-booking-form'

// Details and submission key survive a sign-in in this tab, for the same account only.
function readSavedForm(profileId) {
    try {
        const saved = JSON.parse(sessionStorage.getItem(FORM_KEY))
        return saved?.profileId === profileId && saved.form && typeof saved.submissionKey === 'string' ? saved : null
    } catch {
        return null
    }
}

export default function StudentBookingRoute() {
    const { profile, signOut } = useAuth()

    const [savedForm] = useState(() => readSavedForm(profile.id))
    const [inventoryVersion, setInventoryVersion] = useState(0)

    const saveForm = useCallback((form, submissionKey) => {
        try {
            if (form) sessionStorage.setItem(FORM_KEY, JSON.stringify({ profileId: profile.id, form, submissionKey }))
            else sessionStorage.removeItem(FORM_KEY)
        } catch {
            // shortcut: without session storage the details are lost on sign-in; the cart still keeps the items.
        }
    }, [profile.id])

    const reloadInventory = useCallback(() => setInventoryVersion((version) => version + 1), [])

    // Signing out sends the student to the login page; the draft is restored when they return to Booking.
    const signInAgain = useCallback(() => { signOut().catch(() => {}) }, [signOut])

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
    }, [inventoryVersion])

    return (
        <div className="booking-app student-booking-page">
            <BookingPage
                borrower={{ studentId: profile.id_number }}
                initialItems={cart.items}
                onDraftChange={saveDraft}
                savedForm={savedForm}
                onFormChange={saveForm}
                onStockChanged={reloadInventory}
                onSignIn={signInAgain}
                submitRequest={submitRequest}
                draftNote={cartError}
                inventory={inventory}
                inventoryNote={inventoryNote}
            />
        </div>
    )
}

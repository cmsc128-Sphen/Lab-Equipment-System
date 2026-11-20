
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthContext.js'
import { getIdToken } from '../../auth/getIdToken.js'
import { getItems } from '../../data/items.js'
import { createRequestSubmitter } from '../../services/bookingRequests.js'
import { toBookingItem } from '../../data/inventoryClient.js'
import { readInventoryCart, writeInventoryCart } from '../inventoryCart.js'

import BookingPage from './BookingPage.jsx'

const submitRequest = createRequestSubmitter({
    endpoint: '/api/bookings',
    getAccessToken: getIdToken,
})

const FORM_KEY = 'lab-equipment-booking-form'

// Details and submission key survive a sign-in in this tab, for the same account only.
function readSavedForm(profileId) {
    try {
        const saved = JSON.parse(sessionStorage.getItem(FORM_KEY))
        return saved?.profileId === profileId
            && saved.form
            && typeof saved.submissionKey === 'string'
            ? saved
            : null
    } catch {
        return null
    }
}

export default function StudentBookingRoute() {
    const { profile, signOut } = useAuth()

    // Remount the booking content when the authenticated profile changes.
    return (
        <StudentBookingContent
            key={profile.id}
            profile={profile}
            signOut={signOut}
        />
    )
}

function StudentBookingContent({ profile, signOut }) {
    const [savedForm] = useState(() => readSavedForm(profile.id))
    const [inventoryVersion, setInventoryVersion] = useState(0)

    const saveForm = useCallback((form, submissionKey) => {
        try {
            if (form) {
                sessionStorage.setItem(
                    FORM_KEY,
                    JSON.stringify({
                        profileId: profile.id,
                        form,
                        submissionKey,
                    })
                )
            } else {
                sessionStorage.removeItem(FORM_KEY)
            }
        } catch {
            // Form details may not survive without session storage.
        }
    }, [profile.id])

    const reloadInventory = useCallback(
        () => setInventoryVersion((version) => version + 1),
        []
    )

    // Signing out sends the student to login.
    const signInAgain = useCallback(() => {
        signOut().catch(() => {})
    }, [signOut])

    const [inventory, setInventory] = useState([])
    const [inventoryNote, setInventoryNote] = useState('Loading inventory…')

    function loadCart(userId) {
        try {
            return {
                userId,
                items: readInventoryCart(userId),
                error: '',
            }
        } catch (error) {
            return {
                userId,
                items: [],
                error: error.message,
            }
        }
    }

    // Load only the cart belonging to this authenticated profile.
    const [cart] = useState(() => loadCart(profile.id))
    const activeCart = cart.userId === profile.id
        ? cart
        : { userId: profile.id, items: [], error: '' }

    const [cartError, setCartError] = useState(activeCart.error)

    const saveDraft = useCallback((items) => {
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
                setInventoryNote(
                    items.length
                        ? ''
                        : 'No active inventory items are available.'
                )
            })
            .catch((error) => {
                if (active) setInventoryNote(error.message)
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [inventoryVersion])

    if (cart.userId !== profile.id) {
        return (
            <main className="auth-loading" role="status">
                Loading your booking cart…
            </main>
        )
    }

    return (
        <div className="booking-app student-booking-page">
            <BookingPage
                key={profile.id}
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

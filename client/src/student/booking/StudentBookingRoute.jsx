import BookingPage from './BookingPage.jsx'
import { demoInventory, submitDemoRequest } from './demo.js'

const useMockData = import.meta.env.USE_MOCK_DATA === 'true'

export default function StudentBookingRoute() {
    const inventory = useMockData ? demoInventory : []
    const submitRequest = useMockData ? submitDemoRequest : undefined

    return (
        <div className="booking-app">
            <BookingPage
                inventory={inventory}
                submitRequest={submitRequest}
                demo={useMockData}
            />
        </div>
    )
}

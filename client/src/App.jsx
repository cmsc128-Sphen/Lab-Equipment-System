import BookingPage from './booking/BookingPage.jsx'
import { demoInventory, submitDemoRequest } from './booking/demo.js'

export default function App() {
  return <BookingPage inventory={demoInventory} initialItems={demoInventory.slice(0, 2).map((item, i) => ({ ...item, quantity: i === 0 ? '3' : '25' }))} submitRequest={submitDemoRequest} demo />
}

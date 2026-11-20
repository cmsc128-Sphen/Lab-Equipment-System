import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BookingPage from '../BookingPage.jsx'
import { demoInventory, submitDemoRequest } from '../demo.js'
import PreviewHeader from './PreviewHeader.jsx'
import './preview.css'

createRoot(document.getElementById('booking-preview-root')).render(
  <StrictMode>
    <div className="booking-preview-shell booking-app">
      <PreviewHeader />
      <BookingPage
        inventory={demoInventory}
        initialItems={demoInventory.slice(0, 2).map((item, index) => ({
          ...item,
          quantity: index === 0 ? '3' : '25',
        }))}
        submitRequest={submitDemoRequest}
        demo
      />
    </div>
  </StrictMode>,
)

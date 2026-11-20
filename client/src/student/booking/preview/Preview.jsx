import { useState } from 'react'
import BookingPage from '../BookingPage.jsx'
import { createDemoSubmitter, demoInventory, submitDemoRequest } from '../demo.js'
import PreviewHeader from './PreviewHeader.jsx'

const simulate = new URLSearchParams(location.search).get('simulate')
const submitRequest = simulate ? createDemoSubmitter(simulate) : submitDemoRequest

export default function Preview() {
  const [inventory, setInventory] = useState(demoInventory)
  return (
    <div className="booking-preview-shell booking-app">
      <PreviewHeader />
      <BookingPage
        borrower={{ studentId: '2026-00001' }}
        inventory={inventory}
        initialItems={demoInventory.slice(0, 2).map((item, index) => ({
          ...item,
          quantity: index === 0 ? '3' : '25',
        }))}
        submitRequest={submitRequest}
        // ?simulate=stock: someone else took most of the beakers before this submission.
        onStockChanged={() => setInventory((current) => current.map((item) => item.id === 'demo-beaker' ? { ...item, available: 2 } : item))}
        onSignIn={() => console.info('[preview] Sign in again requested')}
        demo
      />
    </div>
  )
}

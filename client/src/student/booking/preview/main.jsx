import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Preview from './Preview.jsx'
import './preview.css'

createRoot(document.getElementById('booking-preview-root')).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)

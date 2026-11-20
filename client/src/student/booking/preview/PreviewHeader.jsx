import mark from '../assets/department-mark.png'
import markBackground from '../assets/mark-background.svg'

// Demo shell only. Marc supplies the shared application header at integration.
export default function PreviewHeader() {
  return (
    <header className="booking-header">
      <div className="department-mark"><img className="mark-background" src={markBackground} alt="" /><img className="mark-image" src={mark} alt="Department of Chemistry, UP Visayas" /></div>
      <nav aria-label="Main navigation"><span>Lab Equipment System</span><a href="#booking" aria-current="page">Booking</a></nav>
    </header>
  )
}

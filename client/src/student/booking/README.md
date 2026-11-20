# Iven's Sprint 2 booking feature

This folder owns the booking form, selected-item editing, validation, feedback,
confirmation, tests and feature assets. Its CSS selectors are contained by
`.booking-app`. It does not modify `App.jsx`, `main.jsx`, `index.css`,
`index.html`, package files or the shared Vite configuration.

## Team layout

```text
client/src/
  student/
    booking/         Iven: this feature
    inventory/       Ethan: inventory feature
  admin/             Marc: admin features
  components/        Coordinated shared header, buttons and layouts
  services/          Shared API/auth integration
    bookingRequests.js
  App.jsx            Marc: layout and route integration
  main.jsx
  index.css          Coordinated global styles
```

The merged application now routes this feature at /student/booking, alongside
student inventory and admin review. See the [integration report](../../../../docs/ui-integration-report.md)
for the current routes, mock-mode behavior and remaining backend work.
When implementing a real student homepage, place it in `student/home/` and have
Marc import it into `App.jsx`; do not build a complete homepage inside App.

## Run the isolated preview

From `client/`, run the existing `npm run dev` and visit:

`http://localhost:5173/src/student/booking/preview/`

The preview has its own HTML, entry point, demo data and temporary header inside
this feature. It does not import the starter app's global styles or replace its
homepage. The shared header will be supplied by the application at integration.
Demo submission generates a DEMO reference in memory and writes no database data.

Add `?simulate=network`, `session`, `stock` or `lost` to the preview URL to check
failed and repeated submissions. Each fails the first attempt, then saves; `lost`
saves first and loses the response, so the retry must return the same reference.
Attempts and saved references are logged to the browser console.

## Integrate the page

Marc imports the default component from `./student/booking/index.js` in the
shared app/router and renders it under the shared header:

```jsx
import BookingPage from './student/booking/index.js'
import { createRequestSubmitter } from './services/bookingRequests.js'

// endpoint and getAccessToken come from the team's agreed API/auth integration.
const submitRequest = createRequestSubmitter({ endpoint, getAccessToken })

<BookingPage
  initialItems={selectedItems}
  inventory={inventory}
  borrower={profile}
  submitRequest={submitRequest}
/>
```

Props:

- `initialItems`: selection at mount. Each item has unique `id`, `name`,
  `category` (`equipment` or `chemical`), `unit`, numeric `available`, and optional
  `quantity`. Preserve the mounted form while editing the selection.
- `inventory`: items for the local add-item dialog, using the same format.
- `borrower`: authenticated `{ studentId }` from the profile; the field is always
  read-only and is not sent with the request. Mount only after the profile has loaded.
- `onDraftChange(items)`: called after every draft change, and with `[]` once a
  request is saved. The student route uses it to keep the inventory page's
  booking cart (`../inventoryCart.js`) in step with this page.
- `draftNote`: message shown when the saved cart cannot be read or written.
- `savedForm` / `onFormChange(form, submissionKey)`: the student route keeps the
  details and submission key in this tab's session storage (same account only),
  so a sign-in after an expired session restores them; cleared once saved.
- `onStockChanged()`: called when the server reports changed stock; the route
  reloads inventory and the page highlights the items that no longer fit.
- `onSignIn()`: shown as "Sign in again" after an expired session.
- `submitRequest(payload)`: resolves after persistence to
  `{ reference: string, status: 'Pending' }`; rejects with an Error on failure.
- `onChooseItems(currentItems)`: optional callback for Ethan's selection UI.
  It may return a selection array or a Promise of an array to update items without
  losing form values. Returning undefined leaves the existing selection unchanged.
- `demo`: false by default; true only with demo data and simulated submission.

`services/bookingRequests.js` is a booking-specific adapter accepting the agreed
endpoint and async token getter. It does not implement auth or choose an endpoint.
It sends JSON with a Bearer token and surfaces API/session errors to the form.
Adapt this boundary with Marc if the agreed payload/response differs.

Payload:

The student route sends this to `POST /api/bookings`:

```json
{
  "submissionKey": "6c1f0b7e-2d4a-4b8e-9f3c-1a2b3c4d5e6f",
  "subject": "Chemistry 16",
  "purpose": "Laboratory experiment",
  "borrowDate": "2026-11-01",
  "returnDate": "2026-11-02",
  "items": [{ "inventoryId": "inventory-id", "quantity": 200 }]
}
```

The `submit_booking` database function (`database/student-bookings.sql`) takes
the owner from the session, rechecks dates, active items, units and current
stock, and saves the header and lines atomically as Pending. The page keeps one
`submissionKey` per draft, so a retry after an uncertain failure returns the
request already saved instead of creating a second one; the key changes only
after "Create another request". The client never changes stock.

Quantities are integer hundredths, as stored in `request_items` (2 pcs = 200,
25.5 mL = 2550). Units are not sent; the server uses the item's own unit.

The draft starts from the inventory page's booking cart. When inventory loads,
each draft item takes the current name, unit and stock; items that are no longer
listed are removed with a message. Stock shown here is advisory until the server
checks it. Nothing is saved to the database while editing.

Current validation assumptions: all fields required, borrowing today or later,
return on/after borrowing, positive whole quantities for `pcs`, at most two
decimal places for measured units, and quantity no greater than displayed stock. Units stay
tied to inventory. Confirm precision, dates/timezone, student-ID rules and
pending-stock behavior with the team before live integration.

## Checks without editing shared package scripts

From `client/`:

```sh
node --test src/student/booking/booking.test.js
npm run lint
npm run build
./node_modules/.bin/vite build --config src/student/booking/preview/vite.config.js
```

The last command explicitly builds the isolated feature preview into
`client/dist/booking-preview/`; the normal app build alone does not include an
unconnected booking route. Build the preview after the normal app build.

Before handoff, verify editing/add/remove, required-field errors, decimal
chemical quantities, invalid equipment quantities, failed submissions with
preserved values, repeat clicks, Pending confirmation, keyboard dialog dismissal
and mobile layouts. Real Supabase persistence/access checks await Marc/JD.

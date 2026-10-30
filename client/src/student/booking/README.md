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

The empty directories contain placeholders only. No other person's feature is
implemented here. The Vite starter remains at the shared app entry for now.
When implementing a real student homepage, place it in `student/home/` and have
Marc import it into `App.jsx`; do not build a complete homepage inside App.

## Run the isolated preview

From `client/`, run the existing `npm run dev` and visit:

`http://localhost:5173/src/student/booking/preview/`

The preview has its own HTML, entry point, demo data and temporary header inside
this feature. It does not import the starter app's global styles or replace its
homepage. The shared header will be supplied by the application at integration.
Demo submission generates a DEMO reference in memory and writes no database data.

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
- `borrower`: authenticated `{ email, studentId }`; supplied fields are read-only.
  Mount only after the profile has loaded.
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

Proposed payload, pending agreement with Marc and JD:

```json
{
  "borrower": { "email": "student@up.edu.ph", "studentId": "2026-00001" },
  "subject": "Chemistry 16",
  "purpose": "Laboratory experiment",
  "borrowDate": "2026-11-01",
  "returnDate": "2026-11-02",
  "items": [{ "inventoryId": "inventory-id", "quantity": 2, "unit": "pcs" }]
}
```

The server must derive ownership from the authenticated user, verify profile,
canonical units and current stock, save items atomically and assign Pending.
The client never changes stock or implements reservations. Preventing duplicates
across retries still requires server-side idempotency.

Current validation assumptions: all fields required, borrowing today or later,
return on/after borrowing, positive whole equipment quantities, positive decimal
chemical quantities, and quantity no greater than displayed stock. Units stay
tied to inventory. Confirm precision, dates/timezone, email/student-ID rules and
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

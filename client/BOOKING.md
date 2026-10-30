# Sprint 2 booking handoff

Run `npm ci`, then `npm run dev` in `client/`. The root app opens Iven's booking
preview with sample items. The green header, department mark, borrower fields,
apparatus panel, Edit controls and Book action follow Figma frame `63:360`.
Dates, accessible errors and confirmation implement the Sprint 2 requirements.

## Current boundary

The default `App.jsx` uses `submitDemoRequest`. A DEMO reference is generated in
memory; no request is persisted. The preview explicitly labels this behavior.
Authentication, Express, Supabase schema/policies and stock reservation belong
to Marc/JD and are not implemented here. No stock is changed by this form.

## Component integration

`src/booking/BookingPage.jsx` accepts:

- `initialItems`: selected inventory at mount; each item has `id`, `name`,
  `category` (`equipment` or `chemical`), `unit`, `available` (number), and
  optional `quantity`. IDs must be unique. Units come from inventory and cannot
  be changed independently. Remount the page with a new key when loading a
  different selection. Preserve the mounted form when opening inventory.
- `borrower`: authenticated profile `{ email, studentId }`. Supplied values are
  displayed read-only. Mount after the profile has loaded.
- `submitRequest(payload)`: resolves only after persistence to
  `{ reference: string, status: 'Pending' }`; rejects with an Error for failures.
- `onChooseItems(currentItems)`: optional inventory handoff owned by Ethan.
  Without this callback, `inventory` supplies the page's local selection dialog.
- `demo`: defaults to false; enable only with demo data and demo submission.

`src/booking/requestApi.js` exports `createRequestSubmitter` accepting the agreed
`endpoint` and an async `getAccessToken` function from Marc's auth integration.
It sends JSON with a Bearer token. Adapt the response shape here once agreed.
The page keeps its values after rejection and blocks repeat clicks while the
submission is in flight. It does not automatically retry ambiguous failures.
Server-side idempotency is still required to prevent duplicates across retries.

Proposed payload (not an agreed backend contract yet):

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

The server must derive ownership from the authenticated token, verify profile
details, validate canonical units and current stock, save items atomically,
and assign Pending. Client validation is only immediate feedback.

## Rules to confirm with JD/Marc

Current assumptions: all displayed fields required, borrow date today or later,
return date on/after borrowing date, positive whole equipment quantities,
positive decimal chemical quantities, and requested quantity no greater than
displayed stock. No email-domain/student-ID pattern or chemical precision is
invented. Purpose suggestions accept custom text. Confirm these rules, timezone,
the payload, and whether pending requests hold stock before live integration.

## Verification

`npm run test:booking` covers date/quantity validation, payloads and API errors.
`npm run lint` and `npm run build` check the client. Manually verify blank
submission, Edit/remove/add, decimals, server rejection with preserved fields,
repeat clicks, Pending confirmation, keyboard dialog use, and narrow layouts.

Verified in the browser at desktop and 390px mobile widths: add/edit/remove,
keyboard dialog dismissal, required-field errors, fractional chemical amounts,
demo confirmation, single submission on double-click, and retained values after
a simulated server rejection. Native date controls handle both input/change events.

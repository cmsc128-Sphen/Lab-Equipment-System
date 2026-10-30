# Booking-review API proposal

This proposal covers only the Sprint 2 booking-review slice. The React
prototype currently uses local sample data and does not call these routes.
Review the request and inventory fields with the database owner before
implementing Firebase persistence.

## Conventions

- Prefix: `/api`
- JSON request and response bodies
- Quantities are non-negative integers.
- Approval must validate current stock and save the decision and allocations
  atomically on the server. Client-side checks are only for usability.
- Errors use `{ "error": { "code": "...", "message": "..." } }`.

## Routes to agree and implement

### `GET /api/admin/bookings`

List digital borrowing requests for staff review. Optional `status`, `search`,
`page`, and `limit` parameters support the booking queue.

### `GET /api/admin/bookings/:bookingId`

Return the student and request-slip details, requested items, stock-on-hand,
and any staff decision for a single booking.

### `POST /api/admin/bookings/:bookingId/decision`

Approve with item allocations or disapprove with a required reason. The server
rejects allocations above either the requested quantity or current available
stock. Store the staff note and email preference with the decision.

```json
{
  "decision": "approve",
  "allocations": [
    { "itemId": "equipment-id", "quantity": 2 },
    { "itemId": "chemical-id", "quantity": 100 }
  ],
  "staffNotes": "Chemical quantity rationed for this request.",
  "emailDecision": true
}
```

For a disapproval, send `"decision": "disapprove"`, a non-empty
`"disapprovalReason"`, and the `emailDecision` preference.

## Explicitly outside this prototype slice

- Marking approved bookings ready for pickup and recording collection.
- Return verification and inventory reconciliation.
- Sending real email notifications.
- Firebase initialization, staff authentication, and authorization middleware.

The Express scaffold currently exposes only `GET /api/health`. Other `/api`
routes return an explicit `NOT_FOUND` response; they do not simulate success.

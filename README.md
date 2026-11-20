# Lab-Equipment-System

## Authors

- Lunele Iven Moscoso
- John Dave Valentin
- Ethan Sean Gapulan
- Marc Raven Sian

## Figma Design

[Project design](https://www.figma.com/design/ZDwpMP3tRk4zyvx14o6V6f/142-Lab-Final-Project?node-id=15-22)

## Current status

The current build connects account access, inventory selection, student booking submission and a read-only staff Pending queue to Supabase. Student submission is connected; approval, disapproval, allocation changes, pickup readiness and booking notification emails are deferred in the live staff queue. The database review function remains available separately, but the current queue API does not call it.

| Area | Implemented behavior |
| --- | --- |
| Registration and login | Users register themselves with an exact `@up.edu.ph` address. Registration creates a student profile automatically; email verification is required before app access. Login, session restoration and logout are connected. |
| Roles and access | Students access inventory and booking pages. Verified, active `lab_aid` and `admin` accounts access staff review. Backend token checks, stored profile roles and database RLS enforce access. Public registration cannot grant staff or admin roles. |
| Inventory and item selection | The student inventory page and booking item picker load the saved catalogue through the authenticated API. Search, category and availability filters, pagination and a browser-stored booking cart are available. |
| Student booking | Students submit a request and its item lines in one database transaction. The server derives ownership from the account and rechecks details, dates, quantities and stock. An unchanged retry uses the same submission key without creating a duplicate. Pending requests do not reserve stock. |
| Staff booking queue | Staff load saved Pending requests, borrower details, requested quantities and available stock. Search, refresh, loading, empty and failure states are available. The live queue is read-only; its decision endpoint returns `501 BOOKING_DECISIONS_DEFERRED`. |
| Student request records | Authenticated list and detail API endpoints are available for the student's own requests. A student request-history page is not implemented yet. |

The six-table database contains labelled mock records for development. These are saved database fixtures, not a frontend demo fallback; the mock Auth identities are not usable login accounts. Inventory and booking screens use the connected API. No seeder file is used.

Live staff approval/disapproval, allocation editing and pickup-readiness actions are deferred. Pickup/checkout recording, return inspection, stock adjustment, student cancellation, inventory management and account-management screens are not implemented yet. Booking decision and reminder emails are not connected; Supabase Auth confirmation emails are a separate flow. Image uploads remain deferred.

Direct application-table writes remain disabled for ordinary accounts, including staff and admins. Registration uses its Auth trigger, and student booking submission uses a guarded database function. The database review function is retained, but staff decisions are disabled in the live API and UI. The backend also exposes health, Supabase reachability and account-check endpoints; unused routes return 404.

Local setup requires both `client/.env` and `server/.env`, with the same Supabase project URL and publishable key, and both development servers running. Email confirmation requires the frontend's return URL to be allowed in Supabase Auth settings. Automated API, client and database checks are included; their results do not establish delivery to a real UP mailbox or a completed pickup-and-return workflow.

## Known issues and fixes to track

These findings describe the current checkout. An addressed code path still needs its regression checks; this list does not mean the remaining issues have been fixed.

| ID | Priority / status | Issue and required work |
| --- | --- | --- |
| REG-01 | High — open | An unverified signup creates a profile and claims its unique university ID before email verification. Another student's ID can therefore be blocked by an abandoned or malicious signup. Provision the final identity after verification, handle competing claims atomically and define recovery for abandoned registrations. See the [registration trigger](supabase/migrations/20261120121927_up_email_registration.sql). |
| BOOK-01 | High — open | The cart survives in local storage, but the form and submission key are in session storage. A successful submission with a lost response can be submitted again under a new key after the tab closes. Persist the account-specific draft, form and key together until the outcome is confirmed, reconciled or explicitly discarded. Define logout handling without exposing one account's draft to another. See [draft persistence](client/src/student/booking/StudentBookingRoute.jsx) and [cart storage](client/src/student/inventoryCart.js). |
| BOOK-02 | Addressed in code — browser verification pending | The earlier confirmation check accepted only Pending responses. The current page accepts a saved reference with a nonempty status and displays the actual status returned on replay. Retain coverage for a lost response followed by staff review and a retry; the existing request must be confirmed without creating another. See [booking confirmation](client/src/student/booking/BookingPage.jsx). |
| BOOK-03 | Medium — open | Draft reconciliation runs only when `inventory.length` is positive. A successful refresh returning no items leaves stale selections and stock-refresh feedback behind. Track whether inventory has loaded separately from whether it contains items, then reconcile successful empty results too. See [inventory refresh](client/src/student/booking/BookingPage.jsx). |
| QUEUE-01 | Medium — partly addressed | The server now filters requests to Pending, so historical requests are no longer loaded into the live queue. However, the client still loads the complete Pending queue and rejects totals above 5,000, while the server rejects a request page with more than 10,000 item lines. Move search and pagination to the server and bound or separately page request details so valid large queues remain usable. See the [queue client](client/src/services/adminBookings.js) and [booking API](server/bookings.js). |
| BOOK-04 | Medium — open | The form calculates today using the device timezone, while the database uses Asia/Manila. Around midnight, their date validation can disagree. Use Asia/Manila consistently and test devices in other timezones. See [client date validation](client/src/student/booking/booking.js). |

## Next sprint — proposed one-week plan

The next sprint prioritizes registration safety and reliable booking submission before expanding stock-changing workflows. The goal is that a verified student can submit once, recover an uncertain submission after reopening the browser, and view the saved request and its current status. Staff should be able to browse the Pending queue without loading every request at once.

The assignments below are suggested work areas for four members; named ownership can be agreed during sprint planning.

| Work area | Suggested owner | Acceptance criteria |
| --- | --- | --- |
| Registration and submission abuse controls | Member 1 | Resolve REG-01 without adding staff approval to ordinary registration. Unverified signups cannot indefinitely reserve university IDs; verification, duplicate claims and abandoned-signup recovery have database tests. Define and enforce submission quotas that also cover direct Supabase RPC calls, not only Express requests. |
| Durable booking drafts and validation | Member 2 | Resolve BOOK-01, BOOK-03 and BOOK-04. An unchanged uncertain submission retains its key after a tab closes and resolves to the original request; successful empty inventory refreshes remove stale items; date validation agrees with Asia/Manila. Verify BOOK-02 with reviewed replay statuses. |
| Student records and scalable Pending queue | Member 3 | Add My requests and request details using the existing ownership-scoped APIs. Students see only their records and their actual saved statuses after refresh. Resolve QUEUE-01 with server-side search/pagination and bounded detail loading, while preserving the approved design. |
| Browser integration tests and team checks | Member 4 | Add a client `test` script and CI for backend tests, frontend tests, lint and production build. Add browser scenarios for registration rejection, account switching, expired sessions, lost responses, tab reopening, empty inventory and staff queue access. Include full admin-review scenarios when decision actions are enabled. Coordinate integration fixes with the feature owners. |

Suggested schedule:

1. Day 1: agree on registration recovery, draft persistence, API contracts, quota rules and acceptance criteria.
2. Days 2–4: implement the assigned work and its focused regression checks.
3. Day 5: connect the changes and run the student-to-staff Pending-queue demonstration.
4. Days 6–7: fix integration failures, run browser checks and prepare the sprint demo.

The sprint is complete when another member can set up both environment files, register and verify a UP account, submit a booking, recover the same submission after a lost response and tab reopening, and see that request in both the student's records and the staff Pending queue. Automated checks must run consistently, and no test may leave persistent records or stock changes behind. Live confirmation email delivery must be checked separately with a real UP mailbox.

## Follow-up workflows before operational use

The earlier pickup-and-return proposal remains follow-up work rather than a promise to complete every workflow in the same week. Staff decisions are currently deferred in the live UI/API, so the operational sequence is:

1. Connect guarded approval/disapproval, allocation editing and pickup readiness, with stale-data and stock checks.
2. Add cancellation and expiry paths that release reserved stock exactly once. Define which statuses each action accepts.
3. Record physical pickup/checkout, moving reserved quantities to checked-out stock and recording the actor and ledger movement atomically.
4. Add return inspection and reconciliation. Start with complete, undamaged returns of reusable equipment; partial, damaged, missing and consumable cases need explicit stock and outstanding-balance rules before those cases are enabled.

Each stock-changing operation needs role and ownership checks, allowed status transitions, concurrent-request protection and safe repeated submissions. Refreshing either page must show the saved state. A request must not be marked closed while returnable items remain outstanding. The current read-only queue avoids new reservations through its API, but the retained database review function and existing reservations still need these lifecycle paths before operational use.

Stock adjustments, inventory/account-management screens, booking notification emails and image uploads remain separate backlog work. Submission quotas and browser/CI checks are part of the next sprint above, not substitutes for completing the stock lifecycle.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express |
| Database | Supabase |

## Requirements

- Git
- Node.js 22.12+ and npm

## Run the frontend

From `client/`, install dependencies and copy `.env.example` to `.env`. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for login. Inventory and booking always use database reads; the old `USE_MOCK_DATA` flag does not override them.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and register at `/register` or sign in at `/login` with a verified, active account. Run the backend too: Vite proxies `/api` requests to `http://localhost:3000`. The reference-only mock identities in the database have sign-in disabled.

## Run the backend

From `server/`:

```bash
npm install
npm run dev
```

Use `npm start` to run without watch mode. Optional settings in `server/.env` can be copied from `server/.env.example`:

```dotenv
PORT=3000
CLIENT_ORIGINS=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

The server can start without Supabase settings, but the Supabase check requires the project URL and publishable key in `server/.env`. Open `http://localhost:3000/api/health/supabase` to check the connection. A successful response is:

```json
{ "status": "ok", "supabase": "reachable", "database": "not_checked" }
```

This health endpoint reads public Auth settings to confirm API reachability and key acceptance. It does not verify table queries or permissions.

## Inventory data

`GET /api/items?page=1&limit=200` requires a Supabase Bearer access token. The existing authentication middleware verifies it and supplies a user-scoped client, so catalogue reads respect RLS. The endpoint reads active items in active categories, ordered by `name_lower` and UUID, and returns `{ items, total, page, limit, truncated }`. The limit is at most 200 per page; `truncated` indicates that more pages remain.

Both screens use `client/src/data/items.js`. It loads every catalogue page before displaying results, so local search, category filters and pagination cover the complete result set. Incomplete, changing, malformed or oversized catalogues produce an explicit error rather than silently displaying partial search results. The initial client-side catalogue limit is 5,000 items; a larger catalogue needs server-side search/filtering. Page-unmount cancellation and request timeouts stop stale loads.

The unsaved booking cart is stored in browser local storage under a key scoped to the authenticated profile ID. Inventory and booking use the same account-specific cart. Sign-out removes that user's cart and the legacy unscoped cart key; the legacy cart is never read or migrated because its owner cannot be established safely.

## Admin booking review

Sign in with an active, verified `admin` or `lab_aid` account and open `/inventory/admin` (`/admin/bookings` redirects there). Student registrations remain students and cannot access this page or its APIs. The disabled mock identities are reference records, not login accounts.

- `GET /api/admin/bookings?page=1` returns 200 Pending requests per page with borrower snapshots, request lines and current available stock. The page loads the complete Pending queue before local search, with a 5,000-request limit. Loading, empty-queue and read-failure states are distinct; use **Refresh bookings** to retry.
- `POST /api/admin/bookings/:id/decision` is authenticated for staff but returns `501 BOOKING_DECISIONS_DEFERRED`; this sprint's live queue is read-only and cannot approve, disapprove, allocate stock or mark requests ready.

[database/admin-bookings.sql](database/admin-bookings.sql) defines the guarded database review function; it is not called by the live queue API while decisions are deferred. The queue uses the authenticated user's Supabase session and does not use a service key.

## Student booking submission

Sign in with an active, verified student account and open `/student/booking`. The draft starts from the inventory page's booking cart.

- `POST /api/bookings` accepts `submissionKey` (UUID, generated once per draft), `subject`, `purpose`, `borrowDate`, `returnDate` and `items` of `{ inventoryId, quantity }`, with quantities in integer hundredths. Staff accounts receive 403.
- The `submit_booking` database function saves the request header and its lines in one transaction. The owner, borrower snapshot and Pending status come from the signed-in profile; the client cannot set them.
- It rechecks the subject and purpose, dates (Asia/Manila calendar day, no past borrowing date, return on or after borrowing), active items and categories, whole `pcs` quantities, duplicates and current available stock. Any failure saves nothing.
- Pending requests do not reserve stock. The retained database review function can recheck and reserve stock on approval, but that operation is deferred in the live staff API.
- Repeating a submission key returns the request already saved with that key (HTTP 200) instead of saving a second one. A new save returns 201 with `{ id, reference, status: 'Pending', createdAt }`.

[database/student-bookings.sql](database/student-bookings.sql) is additive and is already applied to the connected project. When initializing another project, apply it after the baseline and `admin-bookings.sql`, in the Supabase SQL editor. [database/tests/student-bookings.sql](database/tests/student-bookings.sql) checks permissions, each rejection, no partial saves, the saved header and lines, unchanged stock and key replay. It rolls back all changes and expects the `MOCK-STUDENT-001` and `MOCK-ADMIN-001` fixtures plus at least one active item in stock.

## Database foundation

[database/schema.sql](database/schema.sql) is the baseline definition already applied to the hosted project. Use it to inspect the design or initialize a new, empty project; do not rerun it against the existing project. It contains no sample records.

| Table | Purpose |
| --- | --- |
| profiles | Auth-linked identity, student/staff role, activation and duty status |
| categories | Inventory classifications with stable slug IDs |
| items | Equipment, chemicals and disposables, including stock buckets |
| requests | Borrower snapshots, borrowing dates, status and staff review fields |
| request_items | Item snapshots and requested/approved quantities per request |
| stock_movements | Append-only inventory audit records |


## Checks

Backend health, authentication, inventory and booking API checks, from `server/`:

```bash
npm test
```

Frontend build, catalogue, inventory filter and booking checks, from `client/`:

```bash
npm run build
npm run lint
node --test
```

[database/tests/admin-bookings.sql](database/tests/admin-bookings.sql) verifies the retained database review function's permissions, stale decisions, allocation validation, reservation accounting, disapproval and pickup readiness. It creates its own temporary Pending requests using the `MOCK-STUDENT-001` and `MOCK-ADMIN-001` accounts and active inventory with stock. It rolls back all test records, stock changes and temporary account verification; existing Pending requests are not required. This database check does not enable decisions in the read-only staff queue.

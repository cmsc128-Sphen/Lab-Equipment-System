# Lab-Equipment-System

## Authors

- Lunele Iven Moscoso
- John Dave Valentin
- Ethan Sean Gapulan
- Marc Raven Sian

## Figma Design

[Project design](https://www.figma.com/design/ZDwpMP3tRk4zyvx14o6V6f/142-Lab-Final-Project?node-id=15-22)

## Current status

The current build connects account access, inventory selection, student booking submission and staff review to Supabase. The baseline database, registration trigger, booking submission function and staff review function are present in the connected project.

| Area | Implemented behavior |
| --- | --- |
| Registration and login | Users register themselves with an exact `@up.edu.ph` address. Registration creates a student profile automatically; email verification is required before app access. Login, session restoration and logout are connected. |
| Roles and access | Students access inventory and booking pages. Verified, active `lab_aid` and `admin` accounts access staff review. Backend token checks, stored profile roles and database RLS enforce access. Public registration cannot grant staff or admin roles. |
| Inventory and item selection | The student inventory page and booking item picker load the saved catalogue through the authenticated API. Search, category and availability filters, pagination and a browser-stored booking cart are available. |
| Student booking | Students submit a request and its item lines in one database transaction. The server derives ownership from the account and rechecks details, dates, quantities and stock. An unchanged retry uses the same submission key without creating a duplicate. Pending requests do not reserve stock. |
| Staff booking review | Staff load saved requests, approve allocations, disapprove with a reason and mark approved requests ready for pickup. Approval reserves stock and records ledger entries atomically. Stale decisions and insufficient stock are rejected. |
| Student request records | Authenticated list and detail API endpoints are available for the student's own requests. A student request-history page is not implemented yet. |

The six-table database contains labelled mock records for development. These are saved database fixtures, not a frontend demo fallback; the mock Auth identities are not usable login accounts. Inventory and booking screens use the connected API. No seeder file is used.

Pickup/checkout recording, return inspection, stock adjustment, student cancellation, inventory management and account-management screens are not implemented yet. Marking a request ready does not record a physical pickup. Booking decision and reminder emails are not connected; Supabase Auth confirmation emails are a separate flow. Image uploads remain deferred.

Direct application-table writes remain disabled for ordinary accounts, including staff and admins. Registration uses its Auth trigger, while booking submission and review use guarded database functions. The backend also exposes health, Supabase reachability and account-check endpoints; unused routes return 404.

Local setup requires both `client/.env` and `server/.env`, with the same Supabase project URL and publishable key, and both development servers running. Email confirmation requires the frontend's return URL to be allowed in Supabase Auth settings. Automated API, client and database checks are included; their results do not establish delivery to a real UP mailbox or a completed pickup-and-return workflow.

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

## Admin booking review

Sign in with an active, verified `admin` or `lab_aid` account and open `/inventory/admin` (`/admin/bookings` redirects there). Student registrations remain students and cannot access this page or its APIs. The disabled mock identities are reference records, not login accounts.

- `GET /api/admin/bookings?page=1` returns 200 requests per page with borrower snapshots, request lines and current available stock. The page loads the complete queue before local search and filtering, with a 5,000-request limit. Loading failures show an error without demo fallback; use **Refresh bookings** to retry.
- `POST /api/admin/bookings/:id/decision` accepts `action` (`approved`, `denied`, `ready`), the original `updatedAt`, `staffNotes`, `denialReason`, and approval `allocations` containing request-line `id` and integer-hundredths `quantity`.
- Approval atomically locks the request and stock rows, validates allocations, moves stock from available to reserved, and appends reservation ledger entries. Stale forms, insufficient stock and repeated decisions are rejected. Disapproval requires a reason. Ready-for-pickup only follows approval and does not change stock.
- Decisions record the authenticated reviewer. Email delivery is unavailable; the page states that no email was sent. Refresh after a rejected or uncertain save before trying again.

[database/admin-bookings.sql](database/admin-bookings.sql) is the additive review-function definition already applied to the connected project. Apply it after the baseline when initializing another project. Only the guarded review operation can write; authenticated users retain read-only table grants. No service key is needed in the frontend or review API.

## Student booking submission

Sign in with an active, verified student account and open `/student/booking`. The draft starts from the inventory page's booking cart.

- `POST /api/bookings` accepts `submissionKey` (UUID, generated once per draft), `subject`, `purpose`, `borrowDate`, `returnDate` and `items` of `{ inventoryId, quantity }`, with quantities in integer hundredths. Staff accounts receive 403.
- The `submit_booking` database function saves the request header and its lines in one transaction. The owner, borrower snapshot and Pending status come from the signed-in profile; the client cannot set them.
- It rechecks the subject and purpose, dates (Asia/Manila calendar day, no past borrowing date, return on or after borrowing), active items and categories, whole `pcs` quantities, duplicates and current available stock. Any failure saves nothing.
- Pending requests do not reserve stock. Staff approval rechecks and reserves it.
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
node --test src/data/inventoryClient.test.js src/services/adminBookings.test.js src/student/inventory/inventoryFilters.test.js src/student/booking/booking.test.js src/auth/registration.test.js
```

[database/tests/admin-bookings.sql](database/tests/admin-bookings.sql) verifies review permissions, stale decisions, allocation validation, reservation accounting, disapproval and pickup readiness using the existing mock records. It rolls back all changes, including temporary mock-account verification. It expects two pending mock bookings; use a development database with those fixtures.

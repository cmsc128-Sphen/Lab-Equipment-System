# Lab-Equipment-System

## Authors

- Lunele Iven Moscoso
- John Dave Valentin
- Ethan Sean Gapulan
- Marc Raven Sian

## Figma Design

[Project design](https://www.figma.com/design/ZDwpMP3tRk4zyvx14o6V6f/142-Lab-Final-Project?node-id=15-22)

## Current status

The student inventory page and booking item picker load the saved Supabase catalogue through the authenticated backend. The staff booking queue reads saved Pending requests and their item quantities/available stock. Approval, disapproval, allocations, pickup readiness and email are deferred in the live queue. Student booking submission is not connected yet.

The backend exposes HTTP health endpoints, a Supabase API connection check, the account profile endpoint, authenticated `GET /api/items`, and staff booking review endpoints. Unused routes return 404.

The six-table foundation is created in the connected Supabase project and contains labelled mock data for development. No seeder file is used. Catalogue reads use the account agent's token helper and backend authentication middleware.

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

Open `http://localhost:5173` and sign in with a verified, active account. Run the backend too: Vite proxies `/api` requests to `http://localhost:3000`. The reference-only mock identities in the database have sign-in disabled; account creation is handled by the separate login/register work.

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

- `GET /api/admin/bookings?page=1` returns 200 Pending requests per page with borrower snapshots, request lines and current available stock. The page loads the complete Pending queue before local search, with a 5,000-request limit. Loading, empty-queue and read-failure states are distinct; use **Refresh bookings** to retry.
- `POST /api/admin/bookings/:id/decision` is authenticated for staff but returns `501 BOOKING_DECISIONS_DEFERRED`; this sprint's live queue is read-only and cannot approve, disapprove, allocate stock or mark requests ready.

[database/admin-bookings.sql](database/admin-bookings.sql) defines the guarded database review function; it is not called by the live queue API while decisions are deferred. The queue uses the authenticated user's Supabase session and does not use a service key.

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

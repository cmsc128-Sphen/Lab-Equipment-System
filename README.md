# Lab-Equipment-System

## Authors

- Lunele Iven Moscoso
- John Dave Valentin
- Ethan Sean Gapulan
- Marc Raven Sian

## Figma Design

[Project design](https://www.figma.com/design/ZDwpMP3tRk4zyvx14o6V6f/142-Lab-Final-Project?node-id=15-22)

## Current status

The React frontend contains student inventory and booking screens plus a staff booking-review prototype. These screens use sample data; changes are not persisted and authentication is not implemented.

The backend is a minimal Express server with a Supabase client. `GET /health` and `GET /api/health` report HTTP availability. `GET /api/health/supabase` checks whether the configured project's API is reachable and accepts the publishable key. Authentication, inventory, booking and notification features are not implemented yet; other routes return 404.

The Supabase schema will be built as features are implemented, using the connected Supabase MCP when available. No seeder is used.

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

From `client/`, install dependencies and copy `.env.example` to `.env`. Keep `USE_MOCK_DATA=true` to use the sample inventory and demo booking submission.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Student pages and the admin review screen are available through the page navigation. Demo changes reset on refresh; the frontend is not connected to a backend data service.

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

This reads public Auth settings to confirm API reachability and key acceptance. It does not create data or verify table queries, permissions or the database schema. Those checks will follow when the first table is added. The frontend continues to use sample data.

## Checks

Backend health and unimplemented-route checks, from `server/`:

```bash
npm test
```

Frontend build and booking checks, from `client/`:

```bash
npm run build
node --test src/student/booking/booking.test.js
```

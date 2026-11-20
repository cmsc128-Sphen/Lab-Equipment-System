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

The backend has been reset to a minimal Express server. It exposes only `GET /health` and `GET /api/health`; all other routes return 404. There is no database connection, authentication, inventory API, booking API or notification worker. The previous database migrations, seed data and unused backend implementation have been removed.

Supabase remains the planned database. Its schema and integration will be rebuilt as features are implemented.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express |
| Database | Supabase (planned; not configured) |

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
```

The server starts without database credentials. Its health endpoints report HTTP availability only.

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

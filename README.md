# Lab-Equipment-System

## Authors

- Lunele Iven Moscoso
- John Dave Valentin
- Ethan Sean Gapulan
- Marc Raven Sian

## Figma Design

link:`https://www.figma.com/design/ZDwpMP3tRk4zyvx14o6V6f/142-Lab-Final-Project?node-id=15-22&t=2jdRe1zoi1zIuKeq-1`

## Tech Stack

| Layer | Language |
| --- | --- |
| Frontend | React |
| Backend | Node.js & Express.js |
| Database | Firebase |

## Sprint 2 prototype

The current client prototype focuses on Marc's lab-staff booking-review slice:
searching and filtering sample bookings, checking stock, editing allocations,
adding staff notes, and recording an approve/disapprove decision in React state.
The review layout follows the supplied booking-review wireframe.

The prototype does **not** persist changes, connect to Firebase, authenticate
staff, or send email. The Express server currently provides a health check
only. Proposed booking-review endpoints and the deferred parts of this slice
are documented in [`server/API_CONTRACT.md`](./server/API_CONTRACT.md).

To run the client, follow the client setup below and use the booking list on the
left to select a sample request. Changes reset on refresh. The
“Mark ready for pickup” action is intentionally disabled; pickup preparation,
return verification, and real notifications are not part of this prototype.

## Requirements

- Git
- npm
- Node.js (20.x+)
- A Firebase database

## Installation & Initialization

1. Clone the repo

```bash
git clone https://github.com/Yomaruichi/Lab-Equipment-System.git
cd Lab-Equipment-System
```

2. Create `.env` file in project root

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

3. Set up the client

```bash
cd client
npm install
```

4. Run the client

If you're in the root folder

```bash
cd client
npm run dev
```

else

```bash
npm run dev
```

default address: http://localhost:5173/

5. Set up the server

```bash
cd ../server
npm install
```

6. Run the server

```bash
npm run start
```
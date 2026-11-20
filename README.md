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
| Database | Supabase (PostgreSQL) |

The database is being migrated from Firebase to Supabase. Supabase is the planned database; the existing backend still uses Firebase until the code migration is complete.

## Requirements

- Git
- npm
- Node.js (20.x+)
- A Supabase project

## Installation & Initialization

1. Clone the repo

```bash
git clone https://github.com/Yomaruichi/Lab-Equipment-System.git
cd Lab-Equipment-System
```

2. Prepare Supabase environment variables for the client in `client/.env`

These variables are for the planned Supabase integration and are not connected to the application yet. Existing backend configuration remains necessary until the migration is complete.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
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

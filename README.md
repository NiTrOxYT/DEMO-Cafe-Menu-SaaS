# Café Menu SaaS

> **From table scan to first sip.**  
> A digital café experience that brings the menu, ordering, and day-to-day café operations into one place.

Café Menu SaaS is a full-stack café ordering project built as a pnpm monorepo. Guests can explore a café menu and place orders online, while staff manage the menu and keep service moving from an admin workspace.

## What’s inside

- **A guest-friendly digital menu** with categories, item details, pricing, and a responsive layout.
- **QR-ready ordering** designed for guests who are already at the table.
- **Cart and order flows** that make browsing and submitting an order straightforward.
- **Café administration** for menu and category management, order visibility, analytics, and settings.
- **Rewards and offers experiences** for returning guests and café promotions.
- **A separate API service** for application data and backend operations.

## The stack

| Area | Tools |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| API | Node.js, Express, TypeScript |
| Data | PostgreSQL with Drizzle ORM |
| Guest-facing integrations | Supabase client |
| Workspace | pnpm |

## Project map

```text
.
├── artifacts/
│   ├── cafe-menu/       # Guest menu and admin frontend
│   └── api-server/      # Express API
├── lib/                 # Shared workspace libraries
├── scripts/             # Project scripts
├── package.json         # Workspace commands
└── pnpm-workspace.yaml
```

## Getting started

### Requirements

- Node.js
- pnpm
- A PostgreSQL database
- Supabase project credentials for the frontend

### Install dependencies

```bash
pnpm install
```

### Configure the frontend

Create `artifacts/cafe-menu/.env.local` and set the public Supabase project values:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Use the Supabase **anon/public** key in browser code. Keep service-role keys and other secrets on the server.

### Configure the API

Set the API environment variables for your local database and deployment:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/cafe_menu
PORT=8080
ALLOWED_ORIGINS=http://localhost:3000
```

See [the API environment example](artifacts/api-server/.env.example) for optional logging and object-storage settings. Provide secrets through your local environment or deployment provider; do not commit them.

### Run the app

Start the frontend development server:

```bash
pnpm --filter @workspace/cafe-menu dev
```

Build and start the API in a separate terminal after setting its environment variables:

```bash
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

The frontend and API are separate services. Configure the frontend’s data integrations and API origin for your environment before using the full ordering flow.

## Useful checks

From the repository root:

```bash
pnpm run typecheck
pnpm run build
```

The root build runs type checks and then builds the workspace packages.

## Deployment

The frontend and API are independently deployable. The project has been used with Vercel for the frontend and Render for the API; configure environment variables and allowed origins in each deployment before publishing.

## A note on secrets

Never commit database passwords, Supabase service-role keys, private storage credentials, or production tokens. Rotate any secret that has been accidentally published.

---

Made for cafés that want the convenience of digital ordering with the warmth of being served well. ☕

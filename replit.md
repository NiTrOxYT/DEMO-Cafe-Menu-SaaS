# The Golden Brew — Café Menu SaaS

A premium café menu web app with a dark editorial public menu (QR-scannable) and a full admin panel for managing items, categories, orders, and settings. Currency: INR (₹).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / `PORT` env)
- `pnpm --filter @workspace/cafe-menu run dev` — run the React frontend (port 25924 / `PORT` env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite 6, TailwindCSS v4, Wouter, TanStack Query v5, Framer Motion
- API: Express 5, Pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: Vite (frontend), esbuild CJS (API)

## Where things live

```
artifacts/
  api-server/      Express API — routes, auth, OpenAPI spec
  cafe-menu/       React frontend (also standalone Vercel-deployable)
lib/
  db/              Drizzle schema + migrations
  api-spec/        OpenAPI YAML + Orval codegen config
  api-client-react/ Generated React Query hooks (source of truth from codegen)
```

- DB schema: `lib/db/src/schema.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/`
- Frontend API client (standalone copy): `artifacts/cafe-menu/src/lib/api/`

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed hooks. Never hand-write fetch calls on the client.
- **Standalone Vercel frontend**: `artifacts/cafe-menu` has its own `package.json` with pinned semver versions (no `catalog:` / `workspace:*`), its own `node_modules` (installed via `npm install`), and `vercel.json` with SPA rewrites. Set `VITE_API_URL=<your-api-url>` at build time.
- **Dual API client**: Replit uses the shared `@workspace/api-client-react` lib; the standalone build uses a local copy at `src/lib/api/` that reads `VITE_API_URL` as the base URL.
- **Session-based auth**: Express sessions with `SESSION_SECRET`; admin credentials in DB.
- **Object storage**: Presigned URL flow via `@workspace/object-storage` (S3-compatible).

## Product

- **Public menu** (`/`): Dark editorial design, QR-scannable, category/veg/non-veg filters, search, item detail modal, cart, WhatsApp ordering, bestseller/spicy/veg/non-veg badges.
- **Admin panel** (`/admin`): Login (sourikaich7@gmail.com / sourik), dashboard with stats, menu item CRUD with image upload, category management, live orders page (auto-refreshes every 15s), QR code generator, settings.

## Vercel Deployment (frontend)

1. Point Vercel at `artifacts/cafe-menu/` as the root directory.
2. Install command: `npm install --ignore-scripts`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variable: `VITE_API_URL=https://demo-cafe-menu-saa-s-api-server.vercel.app`
6. `vercel.json` is already present with SPA rewrites and asset caching headers.

## User preferences

- Currency: INR (₹) throughout
- Admin credentials: sourikaich7@gmail.com / sourik
- Dark editorial design for the public menu

## Gotchas

- After editing the OpenAPI spec, always run `pnpm --filter @workspace/api-spec run codegen` then copy updated files to `artifacts/cafe-menu/src/lib/api/` if the standalone copy needs updating.
- The `artifacts/cafe-menu` workflow uses `pnpm --filter @workspace/cafe-menu run dev` — keep the `name` field in `artifacts/cafe-menu/package.json` as `@workspace/cafe-menu` so pnpm's filter can find it.
- The vite.config.ts reads `process.env.PORT` so it works on both Replit (PORT=25924) and plain npm (defaults to 3000).
- `src/components/ui/chart.tsx` and `input-otp.tsx` have `// @ts-nocheck` because shadcn's generated code has minor recharts/input-otp type incompatibilities. This is intentional.
- `skipLibCheck: true` is set in `artifacts/cafe-menu/tsconfig.json` to avoid issues with third-party `.d.ts` files.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

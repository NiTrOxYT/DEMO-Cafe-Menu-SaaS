# The Golden Brew — Café Menu SaaS

A premium café menu web app with a dark editorial public menu (QR-scannable) and a full admin panel for managing items, categories, orders, and settings. Currency: INR (₹).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 / `PORT` env)
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
  db/              Drizzle schema + migrations (source of truth)
  api-spec/        OpenAPI YAML + Orval codegen config
  api-client-react/ Generated React Query hooks (source of truth from codegen)
```

- DB schema source of truth: `lib/db/src/schema.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/`
- Frontend API client (standalone copy): `artifacts/cafe-menu/src/lib/api/`
- DB lib (standalone copy for API): `artifacts/api-server/src/lib/db/`
- Zod schemas (standalone copy for API): `artifacts/api-server/src/lib/api-zod/`

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed hooks. Never hand-write fetch calls on the client.
- **Standalone Vercel frontend**: `artifacts/cafe-menu` has its own `package.json` with pinned semver versions (no `catalog:` / `workspace:*`), its own `node_modules` (installed via `npm install`), and `vercel.json` with SPA rewrites. Set `VITE_API_URL=<your-api-url>` at build time.
- **Standalone Render API**: `artifacts/api-server` has its own `package.json` with pinned semver versions, local copies of `lib/db` and `lib/api-zod` at `src/lib/db/` and `src/lib/api-zod/`, and a `render.yaml`. Set `DATABASE_URL` as an env var.
- **Dual source of truth**: `lib/db/src/schema/` and `lib/api-zod/src/generated/` are the canonical source. After edits, copy them to `artifacts/api-server/src/lib/db/` and `artifacts/api-server/src/lib/api-zod/generated/` respectively.
- **Session-based auth**: Express sessions with cookie-based admin token; in-memory session store (single-server safe).
- **Object storage**: Presigned URL flow via Replit's sidecar endpoint — only works on Replit, not on Render. Image uploads will fail on Render unless replaced with a cloud storage provider.

## Product

- **Public menu** (`/`): Dark editorial design, QR-scannable, category/veg/non-veg filters, search, item detail modal, cart, WhatsApp ordering, bestseller/spicy/veg/non-veg badges.
- **Admin panel** (`/admin`): Login (sourikaich7@gmail.com / sourik), dashboard with stats, menu item CRUD with image upload, category management, live orders page (auto-refreshes every 15s), QR code generator, settings.

## Vercel Deployment (frontend)

1. Point Vercel at `artifacts/cafe-menu/` as the root directory.
2. Install command: `npm install --ignore-scripts`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variable: `VITE_API_URL=https://<your-render-api-url>`
6. `vercel.json` is already present with SPA rewrites and asset caching headers.

## Render Deployment (API)

1. Point Render at `artifacts/api-server/` as the root directory.
2. Build command: `npm install --ignore-scripts && npm run build`
3. Start command: `npm start`
4. Environment variables:
   - `DATABASE_URL` — your Postgres connection string (Render Postgres or external)
   - `NODE_ENV=production`
5. `render.yaml` is already present for Infrastructure-as-Code deployment.
6. **Note**: Object storage (image uploads) uses Replit's sidecar and won't work on Render. To enable uploads on Render, replace `objectStorage.ts` with an S3/Cloudflare R2 implementation.

## User preferences

- Currency: INR (₹) throughout
- Admin credentials: sourikaich7@gmail.com / sourik
- Dark editorial design for the public menu

## Gotchas

- After editing `lib/db/src/schema/` (the canonical DB schema), copy changes to `artifacts/api-server/src/lib/db/schema/` too.
- After running `pnpm --filter @workspace/api-spec run codegen`, copy updated files to `artifacts/cafe-menu/src/lib/api/` AND to `artifacts/api-server/src/lib/api-zod/generated/`.
- The `artifacts/cafe-menu` workflow uses `pnpm --filter @workspace/cafe-menu run dev` — keep the `name` field in `artifacts/cafe-menu/package.json` as `@workspace/cafe-menu`.
- The `artifacts/api-server` workflow uses `pnpm --filter @workspace/api-server run dev` — keep the `name` field in `artifacts/api-server/package.json` as `@workspace/api-server`.
- `vite.config.ts` in cafe-menu reads `process.env.PORT` so it works on Replit (PORT=25924) and defaults to 3000 for plain npm.
- `artifacts/api-server/src/index.ts` defaults PORT to 8080 if not set (Render always provides PORT).
- `src/components/ui/chart.tsx` and `input-otp.tsx` in cafe-menu have `// @ts-nocheck` because shadcn's generated code has minor type incompatibilities. This is intentional.
- `skipLibCheck: true` is set in both standalone tsconfigs.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

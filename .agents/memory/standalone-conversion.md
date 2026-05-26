---
name: Standalone conversion pattern
description: How api-server and cafe-menu were made standalone-deployable alongside the pnpm monorepo
---

Both artifacts are standalone-deployable without breaking the pnpm monorepo workflow:

## Frontend (cafe-menu → Vercel)
- Local copies of shared libs at `src/lib/api/` (from `lib/api-client-react`) and `src/lib/storage/` (from `lib/object-storage-web`)
- `VITE_API_URL` env var sets the API base URL at build time via `custom-fetch.ts`
- `package.json` name kept as `@workspace/cafe-menu` so `pnpm --filter` still works
- `vercel.json` with SPA rewrites; install: `npm install --ignore-scripts`; build: `npm run build`; output: `dist`

## API (api-server → Render)
- Local copies of shared libs at `src/lib/db/` (from `lib/db/src`) and `src/lib/api-zod/` (from `lib/api-zod/src`)
- Route files import from relative `../lib/db` and `../lib/api-zod` instead of `@workspace/*`
- `package.json` name kept as `@workspace/api-server` so `pnpm --filter` still works
- `render.yaml` present; install: `npm install --ignore-scripts`; build: `npm run build`; start: `npm start`
- PORT defaults to 8080 if not set (Render always provides PORT)
- Object storage uses Replit's sidecar (`REPLIT_SIDECAR_ENDPOINT`) — won't work on Render without replacing objectStorage.ts

**Why:** Keeping both pnpm name and standalone package.json means the same codebase works in Replit dev and on external cloud hosts without any branching or env-specific config.

**How to apply:** After any schema change in `lib/db/src/schema/`, copy to `artifacts/api-server/src/lib/db/schema/`. After codegen, copy to both `artifacts/cafe-menu/src/lib/api/` and `artifacts/api-server/src/lib/api-zod/generated/`.

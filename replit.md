# Picha Pulse

Picha Pulse is a Kenya-focused media board for browsing and sharing trade photography and short community clips.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/picha-pulse` — responsive Picha Pulse web app, PWA manifest, service worker, icon, feed, saved items, upload flow, full-screen media viewer, and install guide
- `artifacts/api-server/src/routes/media.ts` — media catalog API
- `artifacts/api-server/src/routes/storage.ts` — direct-to-object-storage upload and serving routes
- `artifacts/api-server/src/routes/auth.ts` — browser and mobile authentication routes
- `lib/db/src/schema/media.ts` — media metadata schema
- `lib/db/src/schema/auth.ts` — user and session tables
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- Uploaded bytes go directly to Replit App Storage through presigned URLs; PostgreSQL stores only searchable media metadata and object paths.
- Uploads and publishing require authentication; browsing and public media viewing remain open.
- Saved media is device-local so people can curate a personal pocket without creating an account.
- The web app is installable as a PWA; the About page uses the native install prompt when available and gives Safari/Chrome fallback instructions.

## Product

- Browse recent Kenyan trade photos and short clips
- Search by title, description, and location
- Filter photos and video clips
- Open images full-screen with zoom controls
- Open videos in a focused player with playback controls
- Save moments locally on the current device
- Sign in and publish image/video media with title, description, and location
- Install Picha Pulse to a phone home screen

## User preferences

- The app uses a tasteful, non-explicit romantic adult portrait for its icon rather than explicit sexual imagery.

## Gotchas

- Regenerate the API client and Zod validators after changing `lib/api-spec/openapi.yaml`.
- Keep object paths in the `/objects/...` form returned by the upload URL endpoint and serve them as `/api/storage${objectPath}`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

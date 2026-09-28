# Rokito Studios

Plataforma comunitaria para descubrir, publicar y moderar proyectos de Roblox Studio y Studio Lite.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run build:frontend` — build the frontend for Cloudflare Pages
- `pnpm run build:backend` — build the Express API for Render
- Required env: `DATABASE_URL` — Postgres connection string
- Frontend uses `VITE_API_URL` when the API is deployed separately; leave it empty for the Replit same-origin preview.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/inmortal-studios` — React/Vite frontend, branded as Rokito Studios and routed for Cloudflare Pages.
- `artifacts/api-server` — Express API, Clerk middleware, Discord verification callback and Render entrypoint.
- `lib/api-spec/openapi.yaml` — source of truth for the public API contract.
- `lib/db/src/schema/community.ts` — PostgreSQL schema for users, projects, verification, moderation and engagement.
- `render.yaml`, `wrangler.toml`, `.github/workflows/ci.yml` — deployment and GitHub automation.

## Architecture decisions

- Clerk is the user authentication provider; the server uses Clerk session middleware and never receives platform passwords.
- The Discord bot communicates through `POST /api/discord/verify` with `x-api-key`; codes expire and are consumed once.
- Project data is persisted in PostgreSQL through Drizzle. Seed data is inserted only when the projects table is empty.
- Frontend and API are separable: Cloudflare Pages uses `VITE_API_URL`, while Render runs the API and can serve the compiled frontend as a fallback.

## Product

The app lets creators explore and publish Roblox projects, manage profiles, verify Discord membership, optionally link public Roblox identity, save favorites, report content and moderate submissions as administrators.

## User preferences

- Keep the public UI in Spanish and use the supplied Rokito Studios logo.

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- On Cloudflare Pages set `VITE_API_URL` to the public Render API URL and use the SPA fallback in `artifacts/inmortal-studios/public/_redirects`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

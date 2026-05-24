# Express + Supabase API starter

A Tarrs-ready Node + Express + TypeScript backend that talks to a
Supabase Postgres. Stateless API; pair it with any frontend (Vercel,
mobile app, etc.).

## What's included

- Express 4 + TypeScript (via `tsx` in dev, compiled to `.dist` in prod)
- Supabase client (server-side, service-role key)
- Helmet + CORS + JSON body parsing
- Pino structured logging
- Zod input validation
- Example `/api/posts` resource: GET list + POST create
- JWT verification middleware (validates Supabase JWTs from frontend)

## How Tarrs uses this

Tarrs auto-injects:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (this server uses service role to bypass RLS)
- `SUPABASE_JWT_SECRET` (for verifying user JWTs from frontend)

Sandbox runs on port 4000 (Tarrs convention for Express backends; frontend is :3000, Python/agent is :8080).

## Local dev

```bash
pnpm install
cp .env.example .env
pnpm dev   # tsx watch, port 4000
```

Apply the migration in `supabase/migrations/001_posts.sql` first.

## Deploy to prod

For most deployments, pair with `nextjs-supabase` on Vercel and host this
backend on the same Tarrs sandbox (or migrate to Fly / Render later).

## Endpoints

- `GET  /api/health`            — liveness probe
- `GET  /api/posts`             — list posts (auth required)
- `POST /api/posts`             — create post (auth required, Zod validated)

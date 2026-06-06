# Express + Supabase API starter

A Tarrs-ready Node + Express + TypeScript backend that talks to
Supabase Postgres. Same architectural pattern as `express-postgres`
(controller → service → data, response envelope, structured errors,
request observability) but adapted to Supabase's RLS + Bearer-auth
model so the AI scaffolding new endpoints sees one consistent shape
across both backends.

Pair it with `nextjs-supabase` for the same-Supabase / cross-domain
SPA pattern, or any frontend that can send `Authorization: Bearer
<supabase_access_token>`.

## What's included

- Express 4 + TypeScript (`tsx watch` in dev, compiled to `.dist` in prod)
- **Two Supabase clients** with explicit rationale:
  - `supabaseAdmin` — service-role key, bypasses RLS (use for server-owned ops)
  - `supabaseAs(req)` — anon key + caller's Bearer token, RLS-enforced (use for everything user-facing)
- **Controller → Service → Data layering** — controllers stay thin, business logic lives in `src/service/`
- **Response envelope**: every endpoint returns `{ success, message, data, debug?, code? }` via `utility/response.ts` — frontend has one parse path
- **Structured errors**: `httpErr(msg, code, { expected?, code? })`; the `expected: true` flag downgrades known upstream 5xx (Supabase down, RLS denial) to WARN logs + forwards the message to the client (raw 500s stay opaque)
- **PostgrestError mapping**: `mapSupabaseError()` / `unwrap()` turn Supabase `{data, error}` results into the same `httpErr` envelope (PGRST116 → 404, 23505 → 409, 42501 → 403, etc.)
- **Request observability**: `requestLogger()` tags every request with a short `requestId` via AsyncLocalStorage (any `logger.*` call inside the handler picks it up); START / END / SLOW / ERROR lines with method, path, status, duration
- Helmet + CORS allowlist
- jose-based JWT verification of Supabase's HS256 access tokens
- `express-rate-limit` standard limiter (60/min) for outbound-cost endpoints
- Opt-in CSRF middleware (see when-to-flip-it in `middleware/csrf.ts`)
- Pino structured logging (pino-pretty in dev, JSON in prod)
- Zod input validation
- Sample `/api/posts` resource: GET list + POST create + DELETE author-only — all RLS-driven, no in-code `ownerId` check

## Layout

```
src/
  controller/         # thin HTTP handlers — parse, call service, response()
  service/            # business logic, the only layer that touches Supabase
  middleware/         # auth (loadSession + requireAuth), rateLimit, csrf (opt-in)
  router/             # mounts everything under /api
  utility/            # response, httpStatusCode, httpErr, logger, env, supabaseError
  db/
    supabase.ts       # admin client + supabaseAs(req) for user-scoped RLS
    types.ts          # placeholder; replace via `pnpm db:types`
supabase/
  migrations/         # raw SQL migrations applied by `supabase db push`
```

## RLS-first authorization

Supabase RLS policies are the source of truth. The service layer
uses `supabaseAs(req)` so those policies actually fire on every
read/write. We deliberately do NOT re-check `if (post.authorId ===
user.id)` in service code — that's exactly what the policy does, and
a duplicated check drifts the day the policy changes.

Two exceptions where you should reach for `supabaseAdmin`:
1. Server-owned operations (cron sweepers, system-only inserts).
2. Rules that can't be expressed as a policy (e.g. "any user with
   `role='admin'` can list everything" when role isn't a column on
   the table).

When you do, write the auth check in code right above the
`supabaseAdmin` call, and explain why RLS isn't enough.

## Auth model

Sign-in / sign-up is NOT proxied through this API. The frontend
talks to Supabase Auth directly via `supabase-js` (or
`@supabase/ssr` in Next.js). The frontend then sends
`Authorization: Bearer <access_token>` on every API call here.

`loadSession` (always on) decodes the token if present; `requireAuth`
(per-route gate) 401s if missing. The decoded user lands on
`req.user`; the raw token lands on `req.accessToken` so
`supabaseAs(req)` can forward it to Postgrest for RLS.

The only auth-shaped endpoint on this server is `GET /api/auth/me`,
which surfaces the decoded JWT plus any server-side augmentation
(role, plan tier, feature flags) the frontend needs.

## Why no CSRF by default?

Bearer-auth APIs don't need CSRF — the attacker page can't read the
legit user's token (it's in their frontend's memory / localStorage,
scoped by origin) and can't forge the Authorization header on a
cross-origin call. So `requireCsrf` is provided but NOT mounted in
`src/index.ts`.

Flip it on if you:
- Add cookie sessions (e.g. via `@supabase/ssr` server actions or
  a same-origin Next.js → Express setup where the browser auto-
  attaches the cookie)
- Allow form posts that can be triggered cross-origin

## How Tarrs uses this

Tarrs auto-injects:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_JWT_SECRET`

Sandbox runs on port 4000 (Tarrs convention: frontend :3000, backend
:4000, Python/agent :8080). Public URL is `<project-slug>.dev.tarrs.io`;
Caddy in the sandbox routes `/api/*` straight at this container.

## Local dev

```bash
pnpm install
cp .env.example .env
# fill the four SUPABASE_* values + CORS_ORIGINS
pnpm dev   # tsx watch, port 4000
```

Apply the migration in `supabase/migrations/` first:

```bash
supabase link --project-ref <ref>    # one-time
supabase db push                     # apply migrations to the linked project
```

## Schema changes

```bash
# 1. Edit a new file under supabase/migrations/ (or use the CLI)
supabase migration new add-something-cool

# 2. Push it
pnpm db:push

# 3. Regenerate Supabase types so the service layer stays type-safe
pnpm db:types
```

## Adding a new resource — the recipe

1. `supabase/migrations/00X_foo.sql` — table + RLS policies (the policies are the authoritative auth check; write them carefully)
2. `pnpm db:push && pnpm db:types` — apply + regenerate types
3. `src/service/foo.ts` — `listFoos(req)`, `createFoo(req, input)`, `deleteFoo(req, id)` — all use `supabaseAs(req)` so RLS fires
4. `src/controller/foo.ts` — Zod-validate input, call service, call `response()`
5. Wire routes in `src/router/index.ts`

The controller never touches Supabase. The service never reads `req.body`.

## Deploy to prod

The Tarrs sandbox handles deploy for you. If you migrate off Tarrs
to Fly / Render, `pnpm build && node .dist/index.js` works given the
same Supabase env vars.

## Endpoints (sample)

- `GET    /api/health`            — liveness
- `GET    /api/auth/me`           — decoded session
- `GET    /api/posts`             — list posts (RLS-scoped)
- `POST   /api/posts`             — create post (RLS-scoped)
- `DELETE /api/posts/:id`         — delete post (RLS-scoped; 404 if not yours)

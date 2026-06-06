# Architecture (locked)

When you add or change code in this repo, **follow these rules**. They
are not preferences — they are how this template is supposed to work.
Deviating is a bug.

## Stack — pinned

| Concern | Choice | Don't substitute |
|---|---|---|
| Data access | **`@supabase/supabase-js`** (PostgREST client) | No Drizzle / Prisma / Sequelize / raw `pg`. The data layer is `supabase-js` because this template's value-add is the Supabase platform (RLS, realtime, storage, auth). ORM-on-top defeats that — `express-postgres` is for the ORM path. |
| Authorization | **RLS policies in `supabase/migrations/`** | Do NOT add `if (post.authorId === userId)` checks in service code. The policy is the source of truth; an in-code duplicate drifts the day the policy changes. |
| Auth (Bearer JWT) | `jose` HS256, audience `"authenticated"` | Don't switch to `jsonwebtoken`. Don't add cookie sessions — Bearer is the idiomatic Supabase pattern (frontend uses `supabase-js` or `@supabase/ssr`, sends `Authorization: Bearer <access_token>`). |
| Migrations | `supabase/migrations/*.sql` via Supabase CLI | No `sequelize.sync()`, no Knex, no dbmate. |
| Validation | Zod | No yup / joi / class-validator. |
| Response shape | `response(res, statusCode, message, data, debug?, code?)` from `src/utility/response.ts` | Every endpoint returns `{ success, message, data, debug?, code? }`. No bare `res.json(...)`. |
| Errors | `httpErr(msg, statusCode, { code?, expected? })` from `src/utility/httpErr.ts` | Don't `throw new Error(...)` with a hand-set statusCode. |
| Postgrest errors | `mapSupabaseError(err)` / `unwrap(result)` from `src/utility/supabaseError.ts` | Don't `catch` PostgrestError and rewrite manually — the helper maps codes to status (PGRST116→404, 23505→409, 42501→403, unknown→502 expected). |
| HTTP status codes | `HTTP_STATUS_CODE` enum | No magic numbers. |
| Logging | `logger` from `src/utility/logger.ts` (pino) | Don't `console.log`. |
| CSRF | **NOT mounted by default** (Bearer auth doesn't need it) | Mount `requireCsrf` only if you add cookie sessions — see `middleware/csrf.ts` header. |

## Folder layout — what each layer is for

```
src/
  index.ts                Express app + middleware order + error chain.
                          Nothing business-logic here.
  router/index.ts         Mounts all controllers under /api.
  controller/             Thin HTTP shell. Parse (Zod-validate), call
                          service, call response(). NO direct Supabase
                          calls. NO ownership checks (RLS owns those).
  service/                Business logic. The ONLY layer that touches
                          Supabase. Uses supabaseAs(req) so RLS fires.
                          Throws httpErr on failure (via mapSupabaseError).
                          NO Request / Response types here.
  middleware/
    auth.ts               loadSession (Bearer -> req.user + req.accessToken)
                          + requireAuth
    csrf.ts               Origin / Referer allowlist (NOT mounted by default)
    rateLimit.ts          per-IP throttle factory
  utility/
    response.ts           envelope
    httpStatusCode.ts     enum
    httpErr.ts            throwable Error with statusCode + expected/code
    logger.ts             pino + requestLogger + errorLogger
    env.ts                validateEnv + corsOrigins + isProd
    supabaseError.ts      PostgrestError -> httpErr mapping
  db/
    supabase.ts           Two clients: supabaseAdmin (service-role,
                          bypasses RLS) + supabaseAs(req) (anon + user
                          JWT, RLS enforced)
    types.ts              `pnpm db:types` output — replace with real
                          Database['public']['Tables'] when you link a
                          Supabase project
supabase/
  migrations/             Raw SQL with RLS policies. Schema source of
                          truth. Apply via `supabase db push`.
```

## The 5-file recipe — adding a new resource

1. `supabase/migrations/00X_<thing>.sql` — table + RLS policies. The policies are the authoritative auth check; write them carefully.
2. `pnpm db:push && pnpm db:types` — apply + regenerate `db/types.ts`.
3. `src/service/<thing>.ts` — `listThings(req)`, `createThing(req, input)`, `deleteThing(req, id)`. All use `supabaseAs(req)` so RLS fires. Wrap Postgrest results with `unwrap()` or map errors with `mapSupabaseError()`.
4. `src/controller/<thing>.ts` — Zod-validate input, call service, call `response()`.
5. Wire routes in `src/router/index.ts`.

The controller never touches Supabase. The service never reads `req.body`.

## When to use `supabaseAdmin` vs `supabaseAs(req)`

**Default**: `supabaseAs(req)`. The user's JWT rides through PostgREST and RLS does its job.

**Reach for `supabaseAdmin` (service-role) ONLY when**:
1. The operation has no user context (cron sweepers, system-only inserts triggered by a webhook).
2. The rule can't be expressed as an RLS policy (e.g. "any user with `role='admin'` can read everything" when role isn't a column on the target table).

When you DO use admin, write the in-code auth check **directly above** the admin call, with a comment explaining why RLS isn't enough.

## Errors — `expected: true` semantics

5xx errors come in two flavors:

**Unexpected** (a bug): `throw httpErr(msg, 500)`. Handler logs ERROR + stack, client sees `"Internal error"`.

**Expected** (known upstream): `throw httpErr(msg, 502, { expected: true })`. Handler logs WARN (no stack), client sees your message. Use this for Supabase 502, customer's project paused, etc. `mapSupabaseError` already sets `expected: true` for unknown postgrest codes.

## What NOT to do

- ❌ Don't add Drizzle / Prisma / Sequelize — use `supabase-js`.
- ❌ Don't re-check ownership in service code — RLS owns it.
- ❌ Don't call Supabase from a controller — go through `service/`.
- ❌ Don't `catch` a PostgrestError and rewrite it — use `mapSupabaseError(err)`.
- ❌ Don't switch to cookie-based auth — Bearer is the Supabase pattern.
- ❌ Don't proxy sign-in / sign-up through this API — frontend talks to Supabase Auth directly. This server only verifies the Bearer.
- ❌ Don't `res.status(...).json(...)` directly — wrap in `response(...)`.
- ❌ Don't `console.log` — use `logger.info(...)`.

## What to do when in doubt

Read `src/controller/posts.ts` + `src/service/posts.ts` — they're the canonical example.

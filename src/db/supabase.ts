import type { Request } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

/**
 * Two clients, two use cases.
 *
 * `supabaseAdmin` — service-role key. Bypasses RLS. Use ONLY for
 * server-owned mutations where the auth check is enforced in code
 * (after `requireAuth`) and the action is allowed regardless of the
 * caller (system jobs, admin endpoints, materialized views).
 *
 * `supabaseAs(req)` — anon key + the caller's access token. RLS is
 * fully in effect. Use this for everything that maps 1:1 to a user
 * action (read their own posts, create a post under their user_id).
 * Lets the database enforce the auth rule and stops "I forgot the
 * .eq('user_id', req.user.id) filter" bugs at the schema level.
 *
 * Rule of thumb: reach for `supabaseAs` first. Only fall back to
 * `supabaseAdmin` when the rule you want can't be expressed as a
 * RLS policy.
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Per-request user-scoped Supabase client. The user's Bearer token
 * rides along on every Postgrest call, so RLS sees `auth.uid()`
 * and policies fire as if the user themselves were querying.
 *
 * Requires SUPABASE_ANON_KEY in env — set when you want RLS-scoped
 * queries. If absent, we throw with a clear message rather than
 * silently fall back to the service-role client (which would defeat
 * the point).
 */
export const supabaseAs = (req: Request): SupabaseClient<Database> => {
  if (!ANON_KEY) {
    throw new Error(
      'supabaseAs() requires SUPABASE_ANON_KEY env. Set it from Supabase project Settings → API → anon (public).',
    );
  }
  const auth = req.header('authorization') ?? '';
  // Keep the same Bearer token the user sent; pass it through to
  // Supabase so it can verify + populate auth.uid() for RLS.
  return createClient<Database>(process.env.SUPABASE_URL!, ANON_KEY, {
    global: {
      headers: { Authorization: auth },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

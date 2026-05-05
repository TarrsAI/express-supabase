import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service-role key. Bypasses RLS;
 * we enforce auth at the route level via verifyJwt middleware.
 *
 * Never use this client from anywhere a customer's browser can reach.
 */
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

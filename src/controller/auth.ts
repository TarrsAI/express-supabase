import type { Request, Response } from 'express';
import response from '../utility/response.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

/**
 * Auth controller intentionally minimal. Sign-in / sign-up are not
 * proxied through this API — the frontend talks to Supabase Auth
 * directly using the supabase-js client (or @supabase/ssr in
 * Next.js). Putting register/login here would double-hop every auth
 * call and force this API to hold password material it doesn't need
 * to see.
 *
 * What lives here:
 *   GET /api/auth/me — surfaces whatever loadSession decoded from
 *   the Bearer token. Frontends use this to confirm a session is
 *   still valid against the API's view of the world, and to fetch
 *   any server-side profile augmentation (role, plan tier, feature
 *   flags — anything the JWT alone doesn't carry).
 */
export const me = (req: Request, res: Response): void => {
  response(res, HTTP_STATUS_CODE.OK, undefined, { user: req.user ?? null });
};

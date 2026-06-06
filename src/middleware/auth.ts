import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

// Augment the Express Request shape so handlers can read req.user
// and req.accessToken after loadSession has populated them. Using
// the global Express namespace works regardless of which version
// of @types/express pulls in express-serve-static-core indirectly.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      accessToken?: string;
    }
  }
}

const secret = (): Uint8Array =>
  new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

/**
 * Verifies a Supabase-issued JWT in `Authorization: Bearer <token>`.
 * On success, attaches `req.user` and stashes the raw token at
 * `req.accessToken` so the per-request `supabaseAs(req)` client can
 * forward it to Postgrest and trigger RLS.
 *
 * We keep this middleware AND the per-request supabase-as-user
 * client because each catches a different mistake:
 *   - middleware: catches missing / forged tokens at the edge before
 *     anything else runs
 *   - supabaseAs: ensures every query the user-facing service code
 *     fires actually runs through RLS
 *
 * Belt + suspenders, low cost — both are HMAC verifications of the
 * same payload.
 */
export const loadSession = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const header = req.header('authorization') ?? '';
  const m = header.match(/^Bearer (.+)$/i);
  if (!m) {
    next();
    return;
  }
  const token = m[1]!;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string') {
      next();
      return;
    }
    req.user = {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    };
    req.accessToken = token;
    next();
  } catch {
    // Expired or malformed token — treat as anonymous. requireAuth
    // below will 401 if the route needs a user.
    next();
  }
};

/**
 * Hard gate — 401s the request when there's no valid session. Mount
 * after loadSession on routes that require auth.
 */
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    next(
      httpErr('Sign in required', HTTP_STATUS_CODE.UNAUTHORIZED, {
        code: 'ERR_AUTH_REQUIRED',
      }),
    );
    return;
  }
  next();
};

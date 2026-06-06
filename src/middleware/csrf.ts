import type { Request, Response, NextFunction } from 'express';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

/**
 * Origin/Referer-based CSRF defense.
 *
 * Why this middleware exists in a Bearer-auth template:
 * Bearer-only APIs *don't* need CSRF — the attacker page can't read
 * the legit user's token (it lives in their frontend's memory /
 * localStorage, scoped by origin) and can't attach the Authorization
 * header on a cross-origin request. So by default this middleware
 * is NOT mounted in `src/index.ts`.
 *
 * You DO want it if you:
 *   - Add cookie sessions (e.g. via @supabase/ssr server actions or
 *     a same-origin Next.js → Express setup where the browser auto-
 *     attaches the cookie)
 *   - Allow form posts (multipart/x-www-form-urlencoded) — those can
 *     be triggered cross-origin without preflight
 *
 * When you opt in: `app.use('/api', requireCsrf)` BEFORE the router.
 * Safe methods (GET/HEAD/OPTIONS) pass through; everything else needs
 * a matching Origin or Referer header.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const parseList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');

const getAllowedOrigins = (): string[] => {
  const explicit = parseList(process.env.CSRF_ALLOWED_ORIGINS);
  if (explicit.length > 0) return explicit;
  return parseList(process.env.CORS_ORIGINS);
};

export const requireCsrf = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    next(
      httpErr('CSRF: no allowed origins configured', HTTP_STATUS_CODE.FORBIDDEN, {
        code: 'ERR_CSRF',
      }),
    );
    return;
  }
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  const source = origin ?? (referer ? new URL(referer).origin : undefined);
  if (!source || !allowed.includes(source)) {
    next(
      httpErr('CSRF: origin not allowed', HTTP_STATUS_CODE.FORBIDDEN, {
        code: 'ERR_CSRF',
      }),
    );
    return;
  }
  next();
};

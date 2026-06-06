import type { PostgrestError } from '@supabase/supabase-js';
import { httpErr, type HttpError } from './httpErr.js';
import { HTTP_STATUS_CODE } from './httpStatusCode.js';

/**
 * Map a PostgrestError (returned in {data, error} responses) to an
 * httpErr with the right status, structured code, and `expected`
 * flag. Service code should call this immediately on `error` so
 * controllers never see a raw Postgrest object.
 *
 * Status mapping rationale:
 *   PGRST116                 No rows / single() returned 0 → 404
 *   23505 (unique_violation) → 409 Conflict (collision the user can fix)
 *   23503 (fk_violation)     → 409 Conflict (related row missing)
 *   23502 (not_null)         → 400 (missing required field — usually
 *                              a bug in the caller, but user-fixable)
 *   23514 (check_violation)  → 422 (constraint says no)
 *   42501 (insufficient_priv)→ 403 (RLS refused — we don't say WHY
 *                              to avoid leaking the policy shape)
 *   PGRST301 (jwt expired)   → 401
 *   anything else            → 502 with expected:true (Supabase is
 *                              upstream; we don't know what blew up,
 *                              but it's not OUR bug — log WARN, not
 *                              ERROR, and forward the message)
 *
 * Keep the codes returned client-side stable (ERR_DB_CONFLICT,
 * ERR_DB_NOT_FOUND, etc.) so frontends can switch on them.
 */
export const mapSupabaseError = (err: PostgrestError): HttpError => {
  switch (err.code) {
    case 'PGRST116':
      return httpErr('Not found', HTTP_STATUS_CODE.NOT_FOUND, {
        code: 'ERR_DB_NOT_FOUND',
      });
    case '23505':
      return httpErr(
        err.message || 'Conflict',
        HTTP_STATUS_CODE.CONFLICT,
        { code: 'ERR_DB_CONFLICT' },
      );
    case '23503':
      return httpErr(
        err.message || 'Related record missing',
        HTTP_STATUS_CODE.CONFLICT,
        { code: 'ERR_DB_FK' },
      );
    case '23502':
      return httpErr(
        err.message || 'Missing required field',
        HTTP_STATUS_CODE.BAD_REQUEST,
        { code: 'ERR_DB_NOT_NULL' },
      );
    case '23514':
      return httpErr(
        err.message || 'Constraint violation',
        HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY,
        { code: 'ERR_DB_CHECK' },
      );
    case '42501':
      return httpErr('Forbidden', HTTP_STATUS_CODE.FORBIDDEN, {
        code: 'ERR_DB_RLS',
      });
    case 'PGRST301':
      return httpErr('Session expired', HTTP_STATUS_CODE.UNAUTHORIZED, {
        code: 'ERR_AUTH_EXPIRED',
      });
    default:
      // Unknown DB-side failure. Treat as upstream — log WARN, forward
      // the (Supabase-curated) message. Customers see e.g. "could not
      // connect to server" which beats "Internal error".
      return httpErr(
        err.message || 'Database unavailable',
        HTTP_STATUS_CODE.BAD_GATEWAY,
        { code: 'ERR_DB_UPSTREAM', expected: true },
      );
  }
};

/**
 * Convenience wrapper for the `{data, error}` pattern. Throws an
 * httpErr on error, returns data on success. Use in service code:
 *
 *   const post = unwrap(
 *     await supabase.from('posts').select('*').eq('id', id).single()
 *   );
 */
export const unwrap = <T>(result: {
  data: T | null;
  error: PostgrestError | null;
}): T => {
  if (result.error) throw mapSupabaseError(result.error);
  if (result.data === null) {
    throw httpErr('Not found', HTTP_STATUS_CODE.NOT_FOUND, {
      code: 'ERR_DB_NOT_FOUND',
    });
  }
  return result.data;
};

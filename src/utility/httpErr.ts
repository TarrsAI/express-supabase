/**
 * Throwable Error that the errorHandler in `src/index.ts` reads to
 * map a status code (and optional structured `code`) back into the
 * response envelope.
 *
 *   throw httpErr('Post not found', 404, { code: 'ERR_POST_NOT_FOUND' });
 *
 * `expected: true` flags errors we threw on purpose for a known
 * upstream / downstream state (Supabase 502, RLS denial we couldn't
 * pre-empt, customer's project paused). The errorHandler will:
 *   - log them at WARN, not ERROR (no stack spam)
 *   - forward the message to the client even on 5xx (5xx without
 *     this flag is opaque "Internal error" to avoid leaking PG /
 *     SQL / IP details from raw 500s)
 */
export interface HttpErrorOptions {
  code?: string;
  expected?: boolean;
}

export interface HttpError extends Error {
  statusCode: number;
  code?: string;
  expected?: boolean;
}

export const httpErr = (
  msg: string,
  statusCode: number,
  opts: HttpErrorOptions = {},
): HttpError => {
  const err = new Error(msg) as HttpError;
  err.statusCode = statusCode;
  if (opts.code) err.code = opts.code;
  if (opts.expected) err.expected = true;
  return err;
};

export default httpErr;

import logger from './logger.js';

/**
 * Required env vars validated at boot. Anything missing crashes the
 * process before the first request lands. Better to fail loud than
 * to start serving with a broken Supabase config silently in place.
 *
 * SUPABASE_SERVICE_ROLE_KEY is the admin key — bypasses RLS, never
 * ship to a browser. SUPABASE_JWT_SECRET is what Supabase signs user
 * JWTs with; we use it to verify the Bearer token on every request.
 */
const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
] as const;

const MIN_SECRET_LEN = 32;

export const validateEnv = (): void => {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required env vars');
    process.exit(1);
  }
  if ((process.env.SUPABASE_JWT_SECRET ?? '').length < MIN_SECRET_LEN) {
    logger.error(
      { minLen: MIN_SECRET_LEN },
      'SUPABASE_JWT_SECRET unexpectedly short — copy from Supabase project: Settings → API → JWT Settings → secret',
    );
    process.exit(1);
  }
};

/**
 * Read CORS_ORIGINS as a comma-separated allowlist. We refuse '*' on
 * purpose: even Bearer-auth APIs leak data via CORS-permitted reads
 * if you let any origin call them.
 */
export const corsOrigins = (): string[] => {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');
};

export const isProd = (): boolean => process.env.NODE_ENV === 'production';

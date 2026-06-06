import rateLimit from 'express-rate-limit';

/**
 * Per-IP throttle on sensitive endpoints. With Supabase auth (Bearer
 * tokens) we don't have the same brute-force surface as a
 * password-login API, but two flows still want a limiter:
 *
 *   - Endpoints that touch outbound cost (LLM, third-party APIs,
 *     SMS) — apply tightly to prevent token-exhaustion attacks.
 *   - Public read endpoints that don't require auth — apply loosely
 *     to keep scrapers from overwhelming the DB.
 *
 * Tuning: 60/min is enough for a real user; way too few for a bot.
 * Lower it on outbound-cost endpoints, raise it on cheap reads.
 */
export const standardLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests — slow down',
    data: null,
    code: 'ERR_RATE_LIMIT',
  },
});

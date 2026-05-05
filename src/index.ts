import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router } from './router/index.js';
import { logger } from './utility/logger.js';

// Fail-fast on missing critical env. Better to crash on boot than at
// the first request that needs the missing value.
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  logger.error({ missing }, 'Missing required env vars');
  process.exit(1);
}

const app = express();

app.use(helmet());

// Comma-separated allowlist. Empty/unset = no cross-origin requests.
// `cors()` with no args allows all origins, which is a phishing risk
// in prod — opt in explicitly.
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );
}

app.use(express.json({ limit: '1mb' }));

app.use('/api', router);

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (
    err: Error & { statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const code = err.statusCode ?? 500;
    logger.error({ err }, 'request failed');
    // 4xx — intentional client-facing message ("Validation failed:
    // email required"). 5xx — message often contains framework /
    // driver internals (DB constraint names, file paths, ORM stack
    // text) that should not reach the client. Log raw above; return
    // a stable generic message.
    if (code >= 500) {
      res.status(code).json({ error: 'Internal server error' });
      return;
    }
    res.status(code).json({ error: err.message ?? 'Bad request' });
  },
);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  logger.info(`API listening on :${port}`);
});

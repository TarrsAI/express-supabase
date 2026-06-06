import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import pino from 'pino';

/**
 * Per-request context attached via AsyncLocalStorage. Any logger.*
 * call inside a handler chain automatically picks up requestId without
 * the handler having to thread it through.
 */
interface LogContext {
  requestId: string;
}

const als = new AsyncLocalStorage<LogContext>();

const isDev = process.env.NODE_ENV !== 'production';

const base = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
  mixin() {
    const ctx = als.getStore();
    return ctx ? { requestId: ctx.requestId } : {};
  },
});

export const logger = base;
export default base;

/**
 * Slow-request threshold. Anything over this emits a SLOW line so
 * latency regressions surface in log search without enabling debug.
 */
const SLOW_MS = 1500;

/**
 * Tag every request with a short requestId, log START / END / SLOW,
 * and make requestId available via AsyncLocalStorage to any logger.*
 * call inside the handler. Mount BEFORE all routes.
 */
export const requestLogger = (): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ||
      randomUUID().slice(0, 8);
    res.setHeader('x-request-id', requestId);

    const start = process.hrtime.bigint();
    base.info(
      { requestId, method: req.method, path: req.path },
      'request.start',
    );

    res.on('finish', () => {
      const durMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      const fields = {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durMs,
      };
      if (res.statusCode >= 500) {
        base.error(fields, 'request.end');
      } else if (durMs >= SLOW_MS) {
        base.warn(fields, 'request.slow');
      } else {
        base.info(fields, 'request.end');
      }
    });

    als.run({ requestId }, () => next());
  };
};

/**
 * Sits before `errorHandler` in the chain. Owns the "should I log
 * this loudly?" decision so the errorHandler stays focused on the
 * response envelope.
 *
 *   - 4xx: client problem, log at debug — these are expected outcomes
 *     of the contract (validation failed, not signed in, etc.).
 *   - 5xx with `expected: true`: we threw it ourselves for a known
 *     upstream state (Supabase 502, customer paused project, RLS
 *     refusal we couldn't pre-empt). Log at WARN with no stack. The
 *     message will still be forwarded to the client by the errorHandler.
 *   - 5xx without flag: a real bug. Log at ERROR with the stack.
 *     The client will see "Internal error" — see errorHandler for why.
 */
export const errorLogger = (): ErrorRequestHandler => {
  return (err, req, _res, next) => {
    if (!err) {
      next();
      return;
    }
    const e = err as Error & { statusCode?: number; expected?: boolean };
    const statusCode = e.statusCode ?? 500;
    const ctx = {
      method: req.method,
      path: req.path,
      statusCode,
      errClass: e.name,
      message: e.message,
    };
    if (statusCode < 500) {
      base.debug(ctx, 'request.client_error');
    } else if (e.expected) {
      base.warn(ctx, 'request.upstream_unavailable');
    } else {
      base.error({ ...ctx, err: e }, 'request.application_error');
    }
    next(err);
  };
};

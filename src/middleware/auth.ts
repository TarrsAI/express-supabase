import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Verifies a Supabase-issued JWT in `Authorization: Bearer <token>`.
 * Attaches `req.user` (id + email) on success. 401s on missing/invalid.
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string };
  }
}

export const verifyJwt = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const auth = req.header('authorization') ?? '';
  const m = auth.match(/^Bearer (.+)$/i);
  if (!m) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    const decoded = jwt.verify(m[1]!, process.env.SUPABASE_JWT_SECRET!) as {
      sub?: string;
      email?: string;
    };
    if (!decoded.sub) {
      res.status(401).json({ error: 'Invalid token (no sub)' });
      return;
    }
    req.user = { id: decoded.sub, email: decoded.email ?? '' };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

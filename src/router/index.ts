import express from 'express';
import { health } from '../controller/health.js';
import { me } from '../controller/auth.js';
import * as postCtrl from '../controller/posts.js';
import { loadSession, requireAuth } from '../middleware/auth.js';

export const router = express.Router();

// Read the Bearer token on every request — cheap (one HMAC verify)
// and means downstream handlers can rely on req.user without each
// route remembering to mount the loader.
router.use(loadSession);

router.get('/health', health);

// Auth — only /me. Sign-in / sign-up live in Supabase Auth (frontend
// calls supabase-js directly). See controller/auth.ts header for why.
router.get('/auth/me', me);

// Sample protected resource. Mount requireAuth ONCE on the prefix so
// every /posts handler is gated; cheaper than per-route + harder to
// forget when adding new endpoints.
router.use('/posts', requireAuth);
router.get('/posts', postCtrl.list);
router.post('/posts', postCtrl.create);
router.delete('/posts/:id', postCtrl.remove);

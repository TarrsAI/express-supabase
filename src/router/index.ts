import express from 'express';
import { health } from '../controller/health.js';
import * as posts from '../controller/posts.js';
import { verifyJwt } from '../middleware/auth.js';

export const router = express.Router();

router.get('/health', health);

// All /posts endpoints require a valid Supabase JWT.
router.use('/posts', verifyJwt);
router.get('/posts', posts.list);
router.post('/posts', posts.create);

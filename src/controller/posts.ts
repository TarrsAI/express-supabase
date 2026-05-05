import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../utility/supabase.js';

export const list = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, body, author_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ posts: data });
  } catch (err) {
    next(err);
  }
};

const CreateBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const { data, error } = await supabase
      .from('posts')
      .insert({
        title: parsed.data.title,
        body: parsed.data.body,
        author_id: req.user!.id,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ post: data });
  } catch (err) {
    next(err);
  }
};

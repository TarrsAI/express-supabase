import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import response from '../utility/response.js';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';
import { listPosts, createPost, removePost } from '../service/posts.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export const list = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const posts = await listPosts(req);
    response(res, HTTP_STATUS_CODE.OK, undefined, { posts });
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
): Promise<void> => {
  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      throw httpErr('Validation failed', HTTP_STATUS_CODE.BAD_REQUEST, {
        code: 'ERR_VALIDATION',
      });
    }
    const post = await createPost(req, {
      title: parsed.data.title,
      body: parsed.data.body,
      authorId: req.user!.id,
    });
    response(res, HTTP_STATUS_CODE.CREATED, 'Post created', { post });
  } catch (err) {
    next(err);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id ?? '';
    if (!UUID_RE.test(id)) {
      throw httpErr('Invalid id', HTTP_STATUS_CODE.BAD_REQUEST);
    }
    await removePost(req, id);
    response(res, HTTP_STATUS_CODE.NO_CONTENT);
  } catch (err) {
    next(err);
  }
};

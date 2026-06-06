import type { Request } from 'express';
import { supabaseAs, supabaseAdmin } from '../db/supabase.js';
import { mapSupabaseError, unwrap } from '../utility/supabaseError.js';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

/**
 * Posts business logic. Two patterns to notice:
 *
 *   1. Authorization is layered. The RLS policies in
 *      supabase/migrations/ are the source of truth ("only authors
 *      can update / delete their own posts"). The service layer here
 *      uses the user-scoped client so those policies actually fire.
 *      We do NOT re-check `if (post.authorId === user.id)` in code
 *      because that's exactly what RLS does, and a second check
 *      drifts the day the policies change.
 *
 *   2. Errors from Supabase are mapped to httpErr via mapSupabaseError
 *      or `unwrap()` BEFORE leaving the service. Controllers should
 *      never see a raw PostgrestError.
 */

export interface PostView {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
}

interface PostRow {
  id: string;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
}

const toView = (r: PostRow): PostView => ({
  id: r.id,
  title: r.title,
  body: r.body,
  authorId: r.author_id,
  createdAt: r.created_at,
});

const LIST_LIMIT = 100;
const POST_COLUMNS = 'id, title, body, author_id, created_at';

export const listPosts = async (req: Request): Promise<PostView[]> => {
  const { data, error } = await supabaseAs(req)
    .from('posts')
    .select(POST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw mapSupabaseError(error);
  return (data ?? []).map((row) => toView(row as PostRow));
};

export interface CreatePostInput {
  title: string;
  body: string;
  authorId: string;
}

export const createPost = async (
  req: Request,
  input: CreatePostInput,
): Promise<PostView> => {
  const { data, error } = await supabaseAs(req)
    .from('posts')
    .insert({
      title: input.title,
      body: input.body,
      author_id: input.authorId,
    })
    .select(POST_COLUMNS)
    .single();
  if (error) throw mapSupabaseError(error);
  if (!data) throw httpErr('Insert returned no row', HTTP_STATUS_CODE.BAD_GATEWAY);
  return toView(data as PostRow);
};

/**
 * Delete a post. Returns 404 for both "doesn't exist" and "exists but
 * belongs to someone else" so non-owners can't probe for row existence.
 *
 * RLS does the actual gate ("delete own"); when the policy refuses,
 * the rowcount is 0, which we surface as 404 — same shape as a real
 * not-found.
 */
export const removePost = async (
  req: Request,
  postId: string,
): Promise<void> => {
  const { data, error } = await supabaseAs(req)
    .from('posts')
    .delete()
    .eq('id', postId)
    .select('id');
  if (error) throw mapSupabaseError(error);
  if (!data || data.length === 0) {
    throw httpErr('Not found', HTTP_STATUS_CODE.NOT_FOUND);
  }
};

/**
 * Admin-only read that intentionally bypasses RLS. Example of when
 * to reach for the service-role client: an internal-only metrics
 * endpoint where the rule "any signed-in admin can see everything"
 * can't be expressed as an RLS policy (admin role isn't a column on
 * posts).
 *
 * The auth check must live in code BEFORE this is called.
 */
export const adminCountPosts = async (): Promise<number> => {
  const result = await supabaseAdmin
    .from('posts')
    .select('id', { count: 'exact', head: true });
  unwrap({ data: result.count ?? 0, error: result.error });
  return result.count ?? 0;
};

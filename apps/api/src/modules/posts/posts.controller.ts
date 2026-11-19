import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import { createPost, deletePost, getPostById, updatePost } from './posts.service';

/** FR8: publish a new post. */
export const publishPost: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const post = await createPost(req.user.id, req.body);
  res.status(201).json({ post });
};

/** Get one post by id. */
export const getPost: RequestHandler = async (req, res) => {
  const post = await getPostById(res.locals.params.id);
  res.json({ post });
};

/** FR9: edit own post. */
export const editPost: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const post = await updatePost(res.locals.params.id, req.user.id, req.body);
  res.json({ post });
};

/** FR9: delete own post. */
export const removePost: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  await deletePost(res.locals.params.id, req.user.id);
  res.status(204).end();
};

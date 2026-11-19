import { Router } from 'express';

import { optionalAuth, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { editPost, getPost, publishPost, removePost } from './posts.controller';
import { createPostSchema, postIdParamsSchema, updatePostSchema } from './posts.schemas';

export const postsRoutes: Router = Router();

postsRoutes.post(
  '/',
  requireAuth,
  validate({ body: createPostSchema }),
  publishPost,
); // FR8

postsRoutes.get(
  '/:id',
  optionalAuth,
  validate({ params: postIdParamsSchema }),
  getPost,
);

postsRoutes.patch(
  '/:id',
  requireAuth,
  validate({ params: postIdParamsSchema, body: updatePostSchema }),
  editPost,
); // FR9

postsRoutes.delete(
  '/:id',
  requireAuth,
  validate({ params: postIdParamsSchema }),
  removePost,
); // FR9

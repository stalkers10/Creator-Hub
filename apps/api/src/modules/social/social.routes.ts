import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { followCreator } from './social.controller';
import { creatorIdParamsSchema, postIdParamsSchema } from './social.schemas';

/**
 * Mounted at the API root: paths below are complete.
 */
export const socialRoutes: Router = Router();

socialRoutes.post(
  '/creators/:id/follow',
  requireAuth,
  validate({ params: creatorIdParamsSchema }),
  followCreator,
); // FR11

// FR35–FR40 — implemented in a later build step.
socialRoutes.post('/posts/:id/like', requireAuth, validate({ params: postIdParamsSchema }), todo('FR35 like or unlike'));
socialRoutes.post('/posts/:id/comments', requireAuth, validate({ params: postIdParamsSchema }), todo('FR36 comment'));
socialRoutes.post('/posts/:id/save', requireAuth, validate({ params: postIdParamsSchema }), todo('FR37 save to favourites'));
socialRoutes.post('/posts/:id/report', requireAuth, validate({ params: postIdParamsSchema }), todo('FR40 report a post'));

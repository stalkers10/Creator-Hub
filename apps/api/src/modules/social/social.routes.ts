import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';

/**
 * Mounted at the API root: paths below are complete.
 * Do not use router.use(requireAuth) here: it would also run for unrelated paths.
 */
export const socialRoutes: Router = Router();

socialRoutes.post('/creators/:id/follow', requireAuth, todo('FR11 follow or unfollow a creator'));
socialRoutes.post('/posts/:id/like', requireAuth, todo('FR35 like or unlike'));
socialRoutes.post('/posts/:id/comments', requireAuth, todo('FR36 comment'));
socialRoutes.post('/posts/:id/save', requireAuth, todo('FR37 save to favourites'));
socialRoutes.post('/posts/:id/report', requireAuth, todo('FR40 report a post'));

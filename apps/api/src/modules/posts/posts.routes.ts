import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { optionalAuth, requireAuth } from '../../middleware/auth';

export const postsRoutes: Router = Router();

postsRoutes.post('/', requireAuth, todo('FR8 publish a video, image or text post'));
postsRoutes.get('/:id', optionalAuth, todo('get one post'));
postsRoutes.patch('/:id', requireAuth, todo('FR9 edit own post'));
postsRoutes.delete('/:id', requireAuth, todo('FR9 delete own post'));

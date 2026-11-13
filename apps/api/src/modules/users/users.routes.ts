import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';
import { getMe } from './users.controller';

export const usersRoutes: Router = Router();

usersRoutes.use(requireAuth);

usersRoutes.get('/me', getMe);
usersRoutes.put('/me', todo('FR3 update profile'));
usersRoutes.patch('/me/creator-mode', todo('FR5 switch creator mode on or off'));

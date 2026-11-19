import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getMe, toggleCreatorMode, updateMe } from './users.controller';
import { creatorModeSchema, updateProfileSchema } from './users.schemas';

export const usersRoutes: Router = Router();

usersRoutes.use(requireAuth);

usersRoutes.get('/me', getMe);
usersRoutes.put('/me', validate({ body: updateProfileSchema }), updateMe); // FR3
usersRoutes.patch('/me/creator-mode', validate({ body: creatorModeSchema }), toggleCreatorMode); // FR5

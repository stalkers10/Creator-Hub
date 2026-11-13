import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';

export const notificationsRoutes: Router = Router();

notificationsRoutes.use(requireAuth);

notificationsRoutes.get('/', todo('FR39 list notifications'));
notificationsRoutes.patch('/:id/read', todo('FR39 mark as read'));

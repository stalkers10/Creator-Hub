import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';

export const creatorsRoutes: Router = Router();

creatorsRoutes.get('/', todo('FR10 list and search creators'));
creatorsRoutes.put('/me', requireAuth, todo('FR7 create or update own creator profile'));
creatorsRoutes.get('/:id', todo('FR10 creator profile'));

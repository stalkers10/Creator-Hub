import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';

export const mediaRoutes: Router = Router();

mediaRoutes.post('/signature', requireAuth, todo('signed Cloudinary upload parameters'));

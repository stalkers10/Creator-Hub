import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { getSignature } from './media.controller';

export const mediaRoutes: Router = Router();

mediaRoutes.post('/signature', requireAuth, getSignature); // FR8

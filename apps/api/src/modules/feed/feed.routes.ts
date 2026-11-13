import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { optionalAuth } from '../../middleware/auth';
import { quotaGuard } from '../../middleware/quota-guard';

export const feedRoutes: Router = Router();

// Visitors can read the feed too: the quota guard decides how long.
feedRoutes.get('/', optionalAuth, quotaGuard, todo('FR13 feed'));

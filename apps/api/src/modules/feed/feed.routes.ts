import { Router } from 'express';

import { optionalAuth } from '../../middleware/auth';
import { quotaGuard } from '../../middleware/quota-guard';
import { validate } from '../../middleware/validate';
import { feedHandler } from './feed.controller';
import { feedQuerySchema } from './feed.schemas';

export const feedRoutes: Router = Router();

// Visitors can browse the feed too — quota guard decides how long (FR17).
feedRoutes.get('/', optionalAuth, quotaGuard, validate({ query: feedQuerySchema }), feedHandler); // FR13

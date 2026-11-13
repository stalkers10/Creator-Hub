import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { optionalAuth } from '../../middleware/auth';

/** Mounted at the API root: paths below are complete. */
export const usageRoutes: Router = Router();

usageRoutes.post('/devices/register', todo('FR16 register the device id'));
usageRoutes.post('/usage/heartbeat', optionalAuth, todo('FR15 add viewing time (server side)'));
usageRoutes.get('/usage/today', optionalAuth, todo('FR14 remaining free time today'));

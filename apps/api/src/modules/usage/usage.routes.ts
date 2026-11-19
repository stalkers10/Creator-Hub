import { Router } from 'express';

import { optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { heartbeatHandler, registerDeviceHandler, todayQuotaHandler } from './usage.controller';
import { heartbeatSchema } from './usage.schemas';

/** Mounted at the API root: paths below are complete. */
export const usageRoutes: Router = Router();

usageRoutes.post('/devices/register', registerDeviceHandler); // FR16
usageRoutes.post(
  '/usage/heartbeat',
  optionalAuth,
  validate({ body: heartbeatSchema }),
  heartbeatHandler,
); // FR15
usageRoutes.get('/usage/today', optionalAuth, todayQuotaHandler); // FR14

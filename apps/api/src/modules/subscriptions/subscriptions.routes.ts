import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAuth } from '../../middleware/auth';

/** Mounted at the API root: paths below are complete. */
export const subscriptionsRoutes: Router = Router();

subscriptionsRoutes.get('/plans', todo('FR22 list active plans'));
subscriptionsRoutes.post('/subscriptions', requireAuth, todo('FR23 create a pending subscription'));
subscriptionsRoutes.get('/subscriptions/me', requireAuth, todo('FR24 FR29 my subscriptions'));
subscriptionsRoutes.post('/subscriptions/:id/cancel', requireAuth, todo('FR28 cancel'));

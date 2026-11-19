import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  cancelSub,
  createSubscription,
  listPlans,
  mySubscriptions,
} from './subscriptions.controller';
import { createSubscriptionSchema, subscriptionIdParamsSchema } from './subscriptions.schemas';

/** Mounted at the API root: paths below are complete. */
export const subscriptionsRoutes: Router = Router();

subscriptionsRoutes.get('/plans', listPlans); // FR22

subscriptionsRoutes.post(
  '/subscriptions',
  requireAuth,
  validate({ body: createSubscriptionSchema }),
  createSubscription,
); // FR23

subscriptionsRoutes.get('/subscriptions/me', requireAuth, mySubscriptions); // FR24/FR29

subscriptionsRoutes.post(
  '/subscriptions/:id/cancel',
  requireAuth,
  validate({ params: subscriptionIdParamsSchema }),
  cancelSub,
); // FR28

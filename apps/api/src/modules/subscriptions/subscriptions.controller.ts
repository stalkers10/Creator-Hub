import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import {
  cancelSubscription,
  createPendingSubscription,
  getUserSubscriptions,
  listActivePlans,
} from './subscriptions.service';

/** FR22: list active plans (public). */
export const listPlans: RequestHandler = async (_req, res) => {
  const plans = await listActivePlans();
  res.json({ plans });
};

/** FR23: create a pending subscription. */
export const createSubscription: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const subscription = await createPendingSubscription(req.user.id, req.body);
  res.status(201).json({ subscription });
};

/** FR24 / FR29: list my subscriptions. */
export const mySubscriptions: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const subscriptionList = await getUserSubscriptions(req.user.id);
  res.json({ subscriptions: subscriptionList });
};

/** FR28: cancel a subscription. */
export const cancelSub: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const subscription = await cancelSubscription(res.locals.params.id, req.user.id);
  res.json({ subscription });
};

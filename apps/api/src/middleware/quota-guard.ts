import type { RequestHandler } from 'express';

/**
 * Blocks feed requests once the free daily viewing time is used up (spec FR17).
 *
 * TODO (build step 3, usage module): implement with this logic
 *  1. If req.user has an active subscription, call next() (FR21).
 *  2. Otherwise compute the seconds used today:
 *       - visitors: daily_usage row of req.deviceId
 *       - members: the larger of the user row and the device row (BR3)
 *  3. If used >= env.DAILY_FREE_SECONDS, respond with quotaExhausted({ resetsAt }) (HTTP 402).
 *  4. Otherwise call next().
 * Always use server time, never the phone's clock.
 */

export const quotaGuard: RequestHandler = (_req, _res, next) => {
  next();
};
 
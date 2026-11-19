import type { RequestHandler } from 'express';

import { quotaExhausted } from '../lib/errors';
import { computeQuotaStatus } from '../modules/usage/usage.service';

/**
 * FR17 / FR21 — Gate feed requests by daily quota.
 *
 * Order of checks (cheapest first):
 *  1. If the user has an active subscription → pass through (FR21).
 *  2. Compute seconds used today for this device / user.
 *  3. If quota is exhausted → 402 QUOTA_EXHAUSTED with resetsAt (FR19).
 *  4. Otherwise → attach quota status to res.locals and call next().
 *
 * SWE applied:
 *  - Single Responsibility: only decides whether to let the request through.
 *    The actual quota computation is in usage.service.ts (DRY — same function
 *    used by GET /usage/today and heartbeat).
 *  - Fail Fast: subscription check short-circuits before any usage query.
 *  - FR17: server time only — now is created here, never taken from the client.
 */
export const quotaGuard: RequestHandler = async (req, res, next) => {
  const now = new Date();

  const status = await computeQuotaStatus({
    deviceId: req.deviceId,
    userId: req.user?.id,
    now,
  });

  if (status.unlimited) {
    res.locals.quota = status;
    return next();
  }

  if (status.remainingSeconds === 0) {
    return next(quotaExhausted({ resetsAt: status.resetsAt }));
  }

  // Attach quota to locals so the feed controller can include it in the response.
  res.locals.quota = status;
  next();
};

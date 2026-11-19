import type { RequestHandler } from 'express';

import { badRequest } from '../../lib/errors';
import { getTodayQuota, recordHeartbeat, registerDevice } from './usage.service';

/** FR16: register or refresh a device. */
export const registerDeviceHandler: RequestHandler = async (req, res) => {
  if (!req.deviceId) throw badRequest('Missing or invalid X-Device-Id header');
  await registerDevice(req.deviceId);
  res.json({ deviceId: req.deviceId });
};

/** FR15: record viewing time and return the updated quota status. */
export const heartbeatHandler: RequestHandler = async (req, res) => {
  const quota = await recordHeartbeat(req.body, req.deviceId, req.user?.id);
  res.json({ quota });
};

/** FR14: return today's remaining free time without changing state. */
export const todayQuotaHandler: RequestHandler = async (req, res) => {
  const quota = await getTodayQuota(req.deviceId, req.user?.id);
  res.json({ quota });
};

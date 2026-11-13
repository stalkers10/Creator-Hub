import type { RequestHandler } from 'express';
import { DEVICE_ID_HEADER } from '@content-platform/shared';
import { z } from 'zod';

const uuid = z.string().uuid();

/** Reads the X-Device-Id header sent by the mobile app and sets req.deviceId when it is valid. */
export const deviceMiddleware: RequestHandler = (req, _res, next) => {
  const parsed = uuid.safeParse(req.header(DEVICE_ID_HEADER));
  if (parsed.success) req.deviceId = parsed.data;
  next();
};

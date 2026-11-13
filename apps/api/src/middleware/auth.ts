import type { RequestHandler } from 'express';

import { forbidden, unauthorized } from '../lib/errors';
import { verifyToken } from '../lib/jwt';

function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** Requires a valid token. Sets req.user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req.header('authorization'));
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(unauthorized());
  req.user = { id: payload.sub, isAdmin: payload.isAdmin };
  next();
};

/** Sets req.user when a valid token is sent, but lets visitors through. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req.header('authorization'));
  const payload = token ? verifyToken(token) : null;
  if (payload) req.user = { id: payload.sub, isAdmin: payload.isAdmin };
  next();
};

/** Use after requireAuth. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user?.isAdmin) return next(forbidden('Administrator access required'));
  next();
};

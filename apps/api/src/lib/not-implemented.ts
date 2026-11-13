import type { RequestHandler } from 'express';

import { notImplemented } from './errors';

/**
 * Placeholder handler for endpoints that are planned but not built yet.
 * Replace it with a real controller function when you implement the feature.
 * @param what short description, ideally with the spec requirement id, e.g. "FR8 publish post"
 */
export const todo =
  (what: string): RequestHandler =>
  (_req, _res, next) => {
    next(notImplemented(what));
  };

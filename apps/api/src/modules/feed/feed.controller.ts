import type { RequestHandler } from 'express';

import { getFeed } from './feed.service';

/** FR13: return a page of feed posts with quota status attached. */
export const feedHandler: RequestHandler = async (req, res) => {
  // quota is set by quotaGuard middleware before this handler runs.
  const feed = await getFeed(res.locals.query, req.user?.id, res.locals.quota);
  res.json(feed);
};

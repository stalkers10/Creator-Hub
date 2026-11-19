import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import { toggleFollow } from './social.service';

/** FR11: follow or unfollow a creator (toggle). */
export const followCreator: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const result = await toggleFollow(req.user.id, res.locals.params.id);
  res.json(result);
};

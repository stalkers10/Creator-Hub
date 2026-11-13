import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import { getPublicUserById } from './users.service';

export const getMe: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  res.json({ user: await getPublicUserById(req.user.id) });
};

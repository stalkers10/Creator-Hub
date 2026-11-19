import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import {
  getCreatorById,
  getCreatorDashboard,
  listCreators,
  updateCreatorProfile,
} from './creators.service';

/** FR10: list / search creators. */
export const listCreatorsHandler: RequestHandler = async (_req, res) => {
  const query = res.locals.query;
  const result = await listCreators(query);
  res.json(result);
};

/**
 * FR10 + FR12: get one creator's public profile.
 * When the requesting user is the owner, returns dashboard stats too.
 */
export const getCreatorHandler: RequestHandler = async (req, res) => {
  const { id } = res.locals.params;

  if (req.user) {
    // Try the dashboard — will return public profile + stats if caller is owner,
    // or fall through to public profile if 403 is thrown (not the owner).
    try {
      const dashboard = await getCreatorDashboard(id, req.user.id);
      return res.json({ creator: dashboard, isDashboard: true });
    } catch {
      // Caller is not the owner — serve the public profile.
    }
  }

  const creator = await getCreatorById(id);
  res.json({ creator, isDashboard: false });
};

/** FR7: update own creator profile. */
export const updateCreatorHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const creator = await updateCreatorProfile(req.user.id, req.body);
  res.json({ creator });
};

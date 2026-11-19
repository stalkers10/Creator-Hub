import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import { getPublicUserById, setCreatorMode, updateProfile } from './users.service';

// ---------------------------------------------------------------------------
// FR1/FR2 — GET /users/me
// ---------------------------------------------------------------------------

export const getMe: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  res.json({ user: await getPublicUserById(req.user.id) });
};

// ---------------------------------------------------------------------------
// FR3 — PUT /users/me
// ---------------------------------------------------------------------------

/**
 * FR3: update the authenticated user's own profile (name and/or email).
 * req.body is already validated and coerced by the validate middleware.
 */
export const updateMe: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const user = await updateProfile(req.user.id, req.body);
  res.json({ user });
};

// ---------------------------------------------------------------------------
// FR5 — PATCH /users/me/creator-mode
// ---------------------------------------------------------------------------

/**
 * FR5: toggle creator mode on or off.
 * req.body is already validated by the validate middleware.
 */
export const toggleCreatorMode: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const user = await setCreatorMode(req.user.id, req.body);
  res.json({ user });
};

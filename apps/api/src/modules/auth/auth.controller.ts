import type { RequestHandler } from 'express';

import * as authService from './auth.service';

export const register: RequestHandler = async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
};

export const login: RequestHandler = async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
};

/** Tokens are stateless: the app deletes its copy. Add a deny-list here if needed later. */
export const logout: RequestHandler = (_req, res) => {
  res.status(204).end();
};

/**
 * FR4: request a password-reset email.
 * Always responds 200 so callers cannot enumerate registered addresses.
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  await authService.requestPasswordReset(req.body);
  res.json({ message: 'If that email is registered you will receive a reset link shortly' });
};

/** FR4: exchange a valid reset token for a new password. */
export const resetPassword: RequestHandler = async (req, res) => {
  await authService.resetPassword(req.body);
  res.json({ message: 'Password updated. You can now log in with your new password.' });
};

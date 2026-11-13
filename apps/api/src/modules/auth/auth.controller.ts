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

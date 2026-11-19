import { Router } from 'express';

import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas';

export const authRoutes: Router = Router();

authRoutes.post('/register', validate({ body: registerSchema }), controller.register);
authRoutes.post('/login', validate({ body: loginSchema }), controller.login);
authRoutes.post('/logout', controller.logout);
authRoutes.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
); // FR4
authRoutes.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  controller.resetPassword,
); // FR4

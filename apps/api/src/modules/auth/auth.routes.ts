import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';
import { loginSchema, registerSchema } from './auth.schemas';

export const authRoutes: Router = Router();

authRoutes.post('/register', validate({ body: registerSchema }), controller.register);
authRoutes.post('/login', validate({ body: loginSchema }), controller.login);
authRoutes.post('/logout', controller.logout);
authRoutes.post('/forgot-password', todo('FR4 request password reset'));
authRoutes.post('/reset-password', todo('FR4 reset password with token'));

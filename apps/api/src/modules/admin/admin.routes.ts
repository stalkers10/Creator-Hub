import { Router } from 'express';

import { todo } from '../../lib/not-implemented';
import { requireAdmin, requireAuth } from '../../middleware/auth';

export const adminRoutes: Router = Router();

adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get('/dashboard', todo('FR43 platform statistics'));
adminRoutes.get('/reports', todo('FR41 list reports'));
adminRoutes.patch('/posts/:id/moderate', todo('FR41 moderate a post'));
adminRoutes.get('/users', todo('FR42 list users'));
adminRoutes.patch('/users/:id', todo('FR42 suspend or ban a user'));
adminRoutes.get('/transactions', todo('FR43 list payments'));

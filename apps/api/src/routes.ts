import { Router } from 'express';

import { adminRoutes } from './modules/admin/admin.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { creatorsRoutes } from './modules/creators/creators.routes';
import { feedRoutes } from './modules/feed/feed.routes';
import { mediaRoutes } from './modules/media/media.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { postsRoutes } from './modules/posts/posts.routes';
import { socialRoutes } from './modules/social/social.routes';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes';
import { usageRoutes } from './modules/usage/usage.routes';
import { usersRoutes } from './modules/users/users.routes';

export const routes: Router = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

routes.use('/auth', authRoutes);
routes.use('/users', usersRoutes);
routes.use('/creators', creatorsRoutes);
routes.use('/posts', postsRoutes);
routes.use('/media', mediaRoutes);
routes.use('/feed', feedRoutes);
routes.use('/payments', paymentsRoutes);
routes.use('/notifications', notificationsRoutes);
routes.use('/admin', adminRoutes);

// These routers declare complete paths (/plans, /subscriptions, /devices, /usage, /creators/:id/follow...)
routes.use(usageRoutes);
routes.use(subscriptionsRoutes);
routes.use(socialRoutes);

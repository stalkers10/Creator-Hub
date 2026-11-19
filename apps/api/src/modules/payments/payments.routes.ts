import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  campayWebhookHandler,
  initiatePaymentHandler,
  myPaymentsHandler,
} from './payments.controller';
import { campayWebhookSchema, initiatePaymentSchema } from './payments.schemas';

export const paymentsRoutes: Router = Router();

paymentsRoutes.post(
  '/',
  requireAuth,
  validate({ body: initiatePaymentSchema }),
  initiatePaymentHandler,
); // FR30

// No requireAuth: call comes from Campay, not from an authenticated user (FR31).
paymentsRoutes.post(
  '/webhook/campay',
  (req, _res, next) => {
    // CamPay callback integrations may send the callback fields in the query
    // string; normalize both documented SDK forms before validating.
    req.body = { ...req.query, ...req.body };
    next();
  },
  validate({ body: campayWebhookSchema }),
  campayWebhookHandler,
); // FR31 / FR34

paymentsRoutes.get('/me', requireAuth, myPaymentsHandler); // FR33

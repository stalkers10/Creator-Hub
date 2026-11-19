import type { RequestHandler } from 'express';

import { unauthorized } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { verifyWebhookSignature } from '../../lib/campay';
import { getUserPayments, handleCampayWebhook, initiatePayment } from './payments.service';

/** FR30: initiate a Campay mobile money collection. */
export const initiatePaymentHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const payment = await initiatePayment(req.user.id, req.body);
  res.status(201).json({ payment });
};

/**
 * FR31 / FR34: Campay webhook.
 *
 * CamPay sends a JWT signature in the callback JSON body; verify it with the
 * app webhook key before looking up or changing a payment.
 *
 * Always responds 200 to valid requests — Campay retries on non-2xx.
 */
export const campayWebhookHandler: RequestHandler = async (req, res) => {
  if (!verifyWebhookSignature(req.body.signature)) {
    logger.warn({ ip: req.ip }, 'Campay webhook: invalid signature');
    res.status(401).end();
    return;
  }

  try {
    await handleCampayWebhook(req.body);
  } catch (error) {
    // Let CamPay retry transient processing failures.
    logger.error({ err: error }, 'Campay webhook processing error');
    res.status(500).end();
    return;
  }
  res.status(200).end();
};

/** FR33: payment history for the authenticated user. */
export const myPaymentsHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const paymentList = await getUserPayments(req.user.id);
  res.json({ payments: paymentList });
};

import type { RequestHandler } from 'express';

import { env } from '../../config/env';
import { unauthorized } from '../../lib/errors';
import { logger } from '../../lib/logger';
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
 * Security: if CAMPAY_WEBHOOK_KEY is configured, the request must carry it
 * in the `x-campay-key` header. Requests with a wrong or missing key are
 * rejected with 401 before any processing starts.
 *
 * Note: Campay's exact header name is an open decision (spec section 6, #7).
 * Update the header name below once confirmed with the provider.
 *
 * Always responds 200 to valid requests — Campay retries on non-2xx.
 */
export const campayWebhookHandler: RequestHandler = async (req, res) => {
  // Signature check — only enforced when CAMPAY_WEBHOOK_KEY is set.
  if (env.CAMPAY_WEBHOOK_KEY) {
    const provided = req.header('x-campay-key');
    if (provided !== env.CAMPAY_WEBHOOK_KEY) {
      logger.warn(
        { ip: req.ip, header: provided ? '[present but wrong]' : '[missing]' },
        'Campay webhook: invalid key',
      );
      // Return 401 so our monitoring picks it up, but do NOT reveal why.
      res.status(401).end();
      return;
    }
  }

  try {
    await handleCampayWebhook(req.body);
  } catch (error) {
    // Log but do not expose internal errors to Campay.
    logger.error({ err: error }, 'Campay webhook processing error');
  }
  // Always 200 — Campay interprets any other status as a failure and retries.
  res.status(200).end();
};

/** FR33: payment history for the authenticated user. */
export const myPaymentsHandler: RequestHandler = async (req, res) => {
  if (!req.user) throw unauthorized();
  const paymentList = await getUserPayments(req.user.id);
  res.json({ payments: paymentList });
};

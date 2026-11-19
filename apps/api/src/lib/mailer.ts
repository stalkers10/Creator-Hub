import nodemailer from 'nodemailer';

import { env } from '../config/env';
import { logger } from './logger';

/**
 * Lazy singleton transport.
 * Uses SMTP when SMTP_HOST is set; falls back to logging the message in development.
 */
function createTransport() {
  if (env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  // No SMTP configured: use Nodemailer's jsonTransport so we can log the output.
  return nodemailer.createTransport({ jsonTransport: true });
}

let transport: ReturnType<typeof createTransport> | null = null;

function getTransport() {
  if (!transport) transport = createTransport();
  return transport;
}

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends a transactional email. In development with no SMTP, logs the content instead. */
export async function sendMail(options: MailOptions): Promise<void> {
  const t = getTransport();

  if (!env.SMTP_HOST) {
    if (env.NODE_ENV !== 'test') {
      logger.info(
        { to: options.to, subject: options.subject },
        '[mailer] No SMTP configured — email not sent',
      );
      logger.info(`[mailer] Email body:\n${options.text}`);
    }
    return;
  }

  await t.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

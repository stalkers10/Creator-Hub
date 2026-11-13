import cron from 'node-cron';

import { env } from '../config/env';
import { logger } from '../lib/logger';
import { runSubscriptionExpiryJob } from './subscription-expiry.job';

/** Registers the scheduled jobs. Skipped in tests. */
export function startJobs(): void {
  if (env.NODE_ENV === 'test') return;

  // Every day at 02:00 Cameroon time
  cron.schedule(
    '0 2 * * *',
    () => {
      runSubscriptionExpiryJob().catch((err) => logger.error({ err }, 'Subscription job failed'));
    },
    { timezone: 'Africa/Douala' },
  );
}

import { logger } from '../lib/logger';

/**
 * Runs once a day.
 * TODO (build step 4):
 *  - mark subscriptions whose end_date is in the past as 'expired' (FR27)
 *  - create 'subscription_reminder' notifications a few days before end_date (FR26)
 *  - create 'subscription_expired' notifications for newly expired subscriptions
 */
export async function runSubscriptionExpiryJob(): Promise<void> {
  logger.info('Subscription expiry job: not implemented yet');
}

import { check, date, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { users } from './users';

/** Anonymous device, created on first app launch. Used to track visitors (spec FR16). */
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Viewing time used per day. A row belongs either to a device (visitors) or to a user (members).
 * When a member uses a device, the larger of the two daily totals applies (spec BR3).
 */
export const dailyUsage = pgTable(
  'daily_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Day in the configured reset time zone, as YYYY-MM-DD. */
    usageDate: date('usage_date', { mode: 'string' }).notNull(),
    secondsUsed: integer('seconds_used').notNull().default(0),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('daily_usage_device_date_uq').on(t.deviceId, t.usageDate),
    uniqueIndex('daily_usage_user_date_uq').on(t.userId, t.usageDate),
    check('daily_usage_one_subject', sql`(${t.deviceId} IS NOT NULL) <> (${t.userId} IS NOT NULL)`),
  ],
);

export type DailyUsage = typeof dailyUsage.$inferSelect;

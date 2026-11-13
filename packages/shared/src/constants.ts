/**
 * Values shared by the API and the mobile app.
 * Keep these in sync with the enums in apps/api/src/db/schema.
 */
export const POST_TYPES = ['video', 'image', 'text'] as const;
export type PostType = (typeof POST_TYPES)[number];

export const MEDIA_TYPES = ['image', 'video'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const SUBSCRIPTION_STATUSES = ['pending', 'active', 'expired', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'success', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_OPERATORS = ['mtn', 'orange'] as const;
export type PaymentOperator = (typeof PAYMENT_OPERATORS)[number];

export const MODERATION_STATUSES = ['visible', 'hidden', 'removed'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const REPORT_TARGET_TYPES = ['post', 'comment', 'user'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'new_follower',
  'post_liked',
  'post_commented',
  'payment_result',
  'subscription_reminder',
  'subscription_expired',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Header the mobile app sends so the API can track the free daily time of visitors. */
export const DEVICE_ID_HEADER = 'x-device-id';

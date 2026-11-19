import { z } from 'zod';

/**
 * FR15 — Heartbeat body.
 * `elapsed` is the number of seconds the app has been in the foreground
 * since the last heartbeat (or since the feed was opened).
 * The server caps it at USAGE_HEARTBEAT_MAX_GAP_SECONDS (anti-abuse).
 */
export const heartbeatSchema = z.object({
  elapsed: z.number().int().positive().max(3600),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

import { z } from 'zod';

// Load apps/api/.env when it exists (production uses real environment variables).
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),

  // Free daily viewing time (spec FR14-FR20). Values are configuration, not code (NFR12).
  DAILY_FREE_SECONDS: z.coerce.number().int().nonnegative().default(900),
  QUOTA_WARNING_SECONDS: z.coerce.number().int().nonnegative().default(60),
  QUOTA_RESET_UTC_OFFSET_MINUTES: z.coerce.number().int().default(60),
  USAGE_HEARTBEAT_MAX_GAP_SECONDS: z.coerce.number().int().positive().default(30),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  CAMPAY_BASE_URL: z.string().optional(),
  CAMPAY_APP_USERNAME: z.string().optional(),
  CAMPAY_APP_PASSWORD: z.string().optional(),
  CAMPAY_WEBHOOK_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    JSON.stringify(parsed.error.flatten().fieldErrors),
  );
  process.exit(1);
}

export const env = parsed.data;

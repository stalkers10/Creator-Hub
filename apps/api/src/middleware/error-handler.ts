import type { ErrorRequestHandler } from 'express';
import type { ApiErrorBody } from '@content-platform/shared';
import { ZodError } from 'zod';

import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/** Turns every error into the JSON shape described by ApiErrorBody. Must be registered last. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten().fieldErrors,
      },
    };
    res.status(400).json(body);
    return;
  }

  if ((err as { type?: string } | null)?.type === 'entity.parse.failed') {
    const body: ApiErrorBody = { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } };
    res.status(400).json(body);
    return;
  }

  logger.error({ err }, 'Unhandled error');
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  };
  res.status(500).json(body);
};

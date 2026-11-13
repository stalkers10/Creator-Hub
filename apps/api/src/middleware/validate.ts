import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates the request with Zod. On failure the error handler answers 400 VALIDATION_ERROR.
 * - body: the parsed result replaces req.body
 * - query / params: the parsed result is stored in res.locals.query / res.locals.params
 *   (Express 5 makes req.query read-only)
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) res.locals.query = schemas.query.parse(req.query);
      if (schemas.params) res.locals.params = schemas.params.parse(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };

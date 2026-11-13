/** Error that is safe to send to the client. Throw it from services and controllers. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do this') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const quotaExhausted = (details?: unknown) =>
  new AppError(402, 'QUOTA_EXHAUSTED', 'Free daily viewing time is used up', details);
export const notImplemented = (what: string) =>
  new AppError(501, 'NOT_IMPLEMENTED', `${what} is not implemented yet`);

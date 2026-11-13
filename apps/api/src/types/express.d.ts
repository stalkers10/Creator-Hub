export interface AuthUser {
  id: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth / optionalAuth when a valid token is sent. */
      user?: AuthUser;
      /** Set by the device middleware when a valid X-Device-Id header is sent. */
      deviceId?: string;
    }
  }
}

import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';

export interface TokenPayload {
  sub: string;
  isAdmin: boolean;
}

export function signToken(user: { id: string; isAdmin: boolean }): string {
  return jwt.sign({ isAdmin: user.isAdmin }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Returns the payload, or null if the token is invalid or expired. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'object' && typeof decoded.sub === 'string') {
      return { sub: decoded.sub, isAdmin: decoded.isAdmin === true };
    }
    return null;
  } catch {
    return null;
  }
}

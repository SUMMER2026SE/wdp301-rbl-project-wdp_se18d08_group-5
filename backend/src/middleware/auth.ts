import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import { assertNotBanned } from '../utils/ban.js';
import type { AuthRequest } from '../types/index.js';

/**
 * Verify JWT access token from Authorization header.
 */
export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Access token required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select('role isBanned bannedUntil');

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    assertNotBanned(user);
    req.user = { userId: payload.userId, role: user.role };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return next(error);
    }

    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Check if user has one of the allowed roles.
 */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}

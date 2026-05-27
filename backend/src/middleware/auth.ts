import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';
import type { AuthRequest } from '../types/index.js';

/**
 * Verify JWT access token from Authorization header.
 */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token required');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
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

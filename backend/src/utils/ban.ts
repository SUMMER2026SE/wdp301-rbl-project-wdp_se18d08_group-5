import { ForbiddenError } from './AppError.js';
import type { IUser } from '../models/User.js';

export function isBanActive(user: Pick<IUser, 'isBanned' | 'bannedUntil'>) {
  if (!user.isBanned) return false;
  if (!user.bannedUntil) return true;
  return user.bannedUntil.getTime() > Date.now();
}

export function assertNotBanned(user: Pick<IUser, 'isBanned' | 'bannedUntil'>) {
  if (!isBanActive(user)) return;

  const message = user.bannedUntil
    ? `Account is banned until ${user.bannedUntil.toISOString()}`
    : 'Account is banned';

  throw new ForbiddenError(message);
}

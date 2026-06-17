import { Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/AppError.js';
import type { RoomRole } from '../types/index.js';
import type { RoomRequest } from './roomGuard.js';

export function roleGuard(roles: Array<RoomRole | 'roomOwner'>) {
  return (req: RoomRequest, _res: Response, next: NextFunction) => {
    const room = req.room;
    const participant = req.roomParticipant;
    const userId = req.user!.userId;

    const isRoomOwner = room?.createdBy?.toString?.() === userId;
    const hasRole = participant && roles.includes(participant.roomRole);
    const ownerAllowed = roles.includes('roomOwner') && isRoomOwner;

    if (!hasRole && !ownerAllowed) {
      throw new ForbiddenError('You do not have permission for this room action');
    }

    next();
  };
}

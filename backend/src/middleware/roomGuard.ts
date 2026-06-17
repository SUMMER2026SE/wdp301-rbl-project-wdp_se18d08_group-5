import { Response, NextFunction } from 'express';
import { DebateRoom } from '../models/DebateRoom.js';
import { ForbiddenError, NotFoundError } from '../utils/AppError.js';
import type { AuthRequest } from '../types/index.js';

export interface RoomRequest extends AuthRequest {
  room?: any;
  roomParticipant?: any;
}

export async function roomParticipantGuard(req: RoomRequest, _res: Response, next: NextFunction) {
  const roomId = req.params.id || req.params.roomId;
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  const participant = room.participants.find(
    (entry) => entry.userId.toString() === req.user!.userId,
  );
  if (!participant) {
    throw new ForbiddenError('You are not a participant in this room');
  }

  req.room = room;
  req.roomParticipant = participant;
  next();
}

import { Response, NextFunction } from 'express';
import { DebateRoom } from '../models/DebateRoom.js';
import { ForbiddenError, NotFoundError } from '../utils/AppError.js';
import type { AuthRequest, RoomRole } from '../types/index.js';

type Guard = (req: AuthRequest, res: Response, next: NextFunction) => void;

/**
 * Build a middleware that loads the room and verifies the user is a participant.
 * Attaches `req.room` and `req.participant` to the request.
 */
function buildParticipantGuard(paramName: string): Guard {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const roomId = req.params[paramName];
      const room = await DebateRoom.findById(roomId).select('+password');

      if (!room) {
        throw new NotFoundError('Room not found');
      }

      const userId = req.user!.userId;
      const participant = room.participants.find(
        (p: any) => p.userId.toString() === userId,
      );

      if (!participant) {
        throw new ForbiddenError('You are not a participant in this room');
      }

      (req as any).room = room;
      (req as any).participant = participant;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Build a middleware that loads the room and verifies the participant's role.
 */
function buildRoleGuard(allowedRoles: RoomRole[], paramName: string): Guard {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const roomId = req.params[paramName];
      const room = await DebateRoom.findById(roomId).select('+password');

      if (!room) {
        throw new NotFoundError('Room not found');
      }

      const userId = req.user!.userId;
      const participant = room.participants.find(
        (p: any) => p.userId.toString() === userId,
      );

      if (!participant) {
        throw new ForbiddenError('You are not a participant in this room');
      }

      if (!allowedRoles.includes(participant.roomRole as RoomRole)) {
        throw new ForbiddenError(
          `This action requires one of: ${allowedRoles.join(', ')}`,
        );
      }

      (req as any).room = room;
      (req as any).participant = participant;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware that loads the room and verifies the user is a participant.
 * Call with no args for the default `:id` param; pass a param name to override.
 *
 * Usage: roomParticipantGuard()           // uses req.params.id
 *        roomParticipantGuard('roomId')   // uses req.params.roomId
 */
export function roomParticipantGuard(paramName: string = 'id'): Guard {
  return buildParticipantGuard(paramName);
}

/**
 * Role-check guard factory.
 *
 * Usage: roomRoleGuard('owner')                       // default :id
 *        roomRoleGuard('owner', 'host')               // default :id
 *        roomRoleGuard('owner', 'host', 'roomId')     // custom param
 */
export function roomRoleGuard(...args: Array<RoomRole | string>): Guard {
  let paramName = 'id';
  let allowedRoles: RoomRole[] = args as RoomRole[];

  if (args.length > 0 && typeof args[args.length - 1] === 'string') {
    paramName = args[args.length - 1] as string;
    allowedRoles = args.slice(0, -1) as RoomRole[];
  }

  return buildRoleGuard(allowedRoles, paramName);
}

/**
 * Convenience guard: requesting user must be the room owner.  Default `:id` param.
 */
export const roomOwnerGuard: Guard = buildRoleGuard(['owner'], 'id');

/**
 * Convenience guard: requesting user must be the room owner OR host.  Default `:id` param.
 */
export const roomHostOrOwnerGuard: Guard = buildRoleGuard(['owner', 'host'], 'id');

/**
 * Convenience guard: requesting user must be the room owner, host, or — when
 * the room has no human host — Judge S1 (the participant who inherits host
 * permissions in a no-host + human-judge debate).
 *
 * Param-aware: pass a route param name like `'roomId'` if the URL uses that.
 */
export const roomControllerGuard = (paramName: string = 'id') => async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const roomId = req.params[paramName];
    const room = await DebateRoom.findById(roomId).select('+password');
    if (!room) throw new NotFoundError('Room not found');

    const userId = req.user!.userId;
    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new ForbiddenError('You are not a participant in this room');

    const isOwner = room.createdBy.toString() === userId;
    const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

    const isHost = effectiveRole === 'host';
    const isJudgeS1 =
      room.hostType !== 'human' &&
      effectiveRole === 'judge' &&
      (participant as any).speakerSlot === 'S1';

    // If debate is active or paused, only the actual debate controller (host or Judge S1) can control
    if (['active', 'paused'].includes(room.status)) {
      if (!isHost && !isJudgeS1) {
        throw new ForbiddenError('Only host or Judge S1 can control the active debate');
      }
    } else {
      // Lobby/waiting/ready state: owner (creator) or host can control
      if (!isOwner && !isHost) {
        throw new ForbiddenError('Only owner or host can control this room');
      }
    }

    (req as any).room = room;
    (req as any).participant = participant;
    next();
  } catch (err) {
    next(err);
  }
};
